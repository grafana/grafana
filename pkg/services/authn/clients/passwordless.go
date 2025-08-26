package clients

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"time"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/loginattempt"
	"github.com/grafana/grafana/pkg/services/notifications"
	tempuser "github.com/grafana/grafana/pkg/services/temp_user"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

var (
	errPasswordlessClientInvalidConfirmationCode = errutil.Unauthorized("passwordless.invalid.confirmation-code", errutil.WithPublicMessage("Invalid confirmation code"))
	errPasswordlessClientTooManyLoginAttempts    = errutil.Unauthorized("passwordless.invalid.login-attempt", errutil.WithPublicMessage("Login temporarily blocked"))
	errPasswordlessClientInvalidEmail            = errutil.Unauthorized("passwordless.invalid.email", errutil.WithPublicMessage("Invalid email"))
	errPasswordlessClientCodeAlreadySent         = errutil.Unauthorized("passwordless.invalid.code", errutil.WithPublicMessage("Code already sent to email"))

	errPasswordlessClientInternal = errutil.Internal("passwordless.failed", errutil.WithPublicMessage("An internal error occurred in the Passwordless client"))

	errPasswordlessClientMissingCode = errutil.BadRequest("passwordless.missing.code", errutil.WithPublicMessage("Missing code"))
)

const passwordlessKeyPrefix = "passwordless-%s"

var _ authn.RedirectClient = new(Passwordless)

func ProvidePasswordless(cfg *setting.Cfg, loginAttempts loginattempt.Service, userService user.Service, tempUserService tempuser.Service, notificationService notifications.Service, cache remotecache.CacheStorage) *Passwordless {
	return &Passwordless{cfg, loginAttempts, userService, tempUserService, notificationService, cache, log.New("authn.passwordless")}
}

type PasswordlessCacheCodeEntry struct {
	Email            string `json:"email"`
	ConfirmationCode string `json:"confirmation_code"`
	SentDate         string `json:"sent_date"`
}

type PasswordlessCacheEmailEntry struct {
	Code     string `json:"code"`
	SentDate string `json:"sent_date"`
}

type Passwordless struct {
	cfg                 *setting.Cfg
	loginAttempts       loginattempt.Service
	userService         user.Service
	tempUserService     tempuser.Service
	notificationService notifications.Service
	cache               remotecache.CacheStorage
	log                 log.Logger
}

type EmailForm struct {
	Email string `json:"email" binding:"required,email"`
}

type PasswordlessForm struct {
	Code             string `json:"code" binding:"required"`
	ConfirmationCode string `json:"confirmationCode" binding:"required"`
	Name             string `json:"name"`
	Username         string `json:"username"`
}

// Authenticate implements authn.Client.
func (c *Passwordless) Authenticate(ctx context.Context, r *authn.Request) (*authn.Identity, error) {
	var form PasswordlessForm
	if err := web.Bind(r.HTTPRequest, &form); err != nil {
		return nil, err
	}

	return c.authenticatePasswordless(ctx, r, form)
}

func (c *Passwordless) generateCodes() (string, string, error) {
	alphabet := []byte("BCDFGHJKLMNPQRSTVWXZ")
	confirmationCode, err := util.GetRandomString(8, alphabet...)
	if err != nil {
		return "", "", err
	}
	code, err := util.GetRandomString(32)
	if err != nil {
		return "", "", err
	}
	return confirmationCode, code, err
}

// RedirectURL implements authn.RedirectClient.
func (c *Passwordless) RedirectURL(ctx context.Context, r *authn.Request) (*authn.Redirect, error) {
	var form EmailForm
	if err := web.Bind(r.HTTPRequest, &form); err != nil {
		return nil, err
	}

	ok, err := c.loginAttempts.Validate(ctx, form.Email)
	if err != nil {
		return nil, err
	}

	if !ok {
		return nil, errPasswordlessClientTooManyLoginAttempts.Errorf("too many consecutive incorrect login attempts for user - login for user temporarily blocked")
	}

	ok, err = c.loginAttempts.ValidateIPAddress(ctx, web.RemoteAddr(r.HTTPRequest))
	if err != nil {
		return nil, err
	}

	if !ok {
		return nil, errPasswordlessClientTooManyLoginAttempts.Errorf("too many consecutive incorrect login attempts for IP address - login for IP address temporarily blocked")
	}

	err = c.loginAttempts.Add(ctx, form.Email, web.RemoteAddr(r.HTTPRequest))
	if err != nil {
		return nil, err
	}

	code, err := c.startPasswordless(ctx, form.Email)
	if err != nil {
		return nil, err
	}

	return &authn.Redirect{
		URL:   c.cfg.AppSubURL + "/login?code=" + code,
		Extra: map[string]string{"code": code},
	}, nil
}

func (c *Passwordless) IsEnabled() bool {
	return true
}

func (c *Passwordless) Name() string {
	return authn.ClientPasswordless
}

func (c *Passwordless) startPasswordless(ctx context.Context, email string) (string, error) {
	// 1. check if is existing user with email or user invite with email
	var existingUser *user.User
	var tempUsers []*tempuser.TempUserDTO
	var err error

	if !util.IsEmail(email) {
		return "", errPasswordlessClientInvalidEmail.Errorf("invalid email %s", email)
	}

	cacheKey := fmt.Sprintf(passwordlessKeyPrefix, email)
	_, err = c.cache.Get(ctx, cacheKey)
	if err != nil && !errors.Is(err, remotecache.ErrCacheItemNotFound) {
		return "", errPasswordlessClientInternal.Errorf("cache error: %s", err)
	}

	// if code already sent to email, return error
	if err == nil {
		return "", errPasswordlessClientCodeAlreadySent.Errorf("passwordless code already sent to email %s", email)
	}

	existingUser, err = c.userService.GetByEmail(ctx, &user.GetUserByEmailQuery{Email: email})
	if err != nil && !errors.Is(err, user.ErrUserNotFound) {
		return "", errPasswordlessClientInternal.Errorf("error retreiving user by email: %w - email: %s", err, email)
	}

	if existingUser == nil {
		tempUsers, err = c.tempUserService.GetTempUsersQuery(ctx, &tempuser.GetTempUsersQuery{Email: email, Status: tempuser.TmpUserInvitePending})

		if err != nil && !errors.Is(err, tempuser.ErrTempUserNotFound) {
			return "", err
		}
		if tempUsers == nil {
			return "", errPasswordlessClientInvalidEmail.Errorf("no user or invite found with email %s", email)
		}
	}

	// 2. if existing user or temp user found, send email with passwordless link
	confirmationCode, code, err := c.generateCodes()
	if err != nil {
		return "", err
	}

	emailCmd := notifications.SendEmailCommand{
		To: []string{email},
		Data: map[string]any{
			"Email":            email,
			"ConfirmationCode": confirmationCode,
			"Code":             code,
			"Expire":           c.cfg.PasswordlessMagicLinkAuth.CodeExpiration.Minutes(),
		},
	}

	if existingUser != nil {
		emailCmd.Template = "passwordless_verify_existing_user"
	} else {
		emailCmd.Template = "passwordless_verify_new_user"
	}

	err = c.notificationService.SendEmailCommandHandler(ctx, &emailCmd)
	if err != nil {
		return "", err
	}

	sentDate := time.Now().Format(time.RFC3339)

	value := &PasswordlessCacheCodeEntry{
		Email:            email,
		ConfirmationCode: confirmationCode,
		SentDate:         sentDate,
	}
	valueBytes, err := json.Marshal(value)
	if err != nil {
		return "", err
	}

	cacheKey = fmt.Sprintf(passwordlessKeyPrefix, code)
	err = c.cache.Set(ctx, cacheKey, valueBytes, c.cfg.PasswordlessMagicLinkAuth.CodeExpiration)
	if err != nil {
		return "", errPasswordlessClientInternal.Errorf("cache error: %s", err)
	}

	// second cache entry to lookup code by email
	emailValue := &PasswordlessCacheEmailEntry{
		Code:     code,
		SentDate: sentDate,
	}
	valueBytes, err = json.Marshal(emailValue)
	if err != nil {
		return "", err
	}

	cacheKey = fmt.Sprintf(passwordlessKeyPrefix, email)
	err = c.cache.Set(ctx, cacheKey, valueBytes, c.cfg.PasswordlessMagicLinkAuth.CodeExpiration)
	if err != nil {
		return "", errPasswordlessClientInternal.Errorf("cache error: %s", err)
	}

	return code, nil
}

func (c *Passwordless) authenticatePasswordless(ctx context.Context, r *authn.Request, form PasswordlessForm) (*authn.Identity, error) {
	code := form.Code
	confirmationCode := form.ConfirmationCode

	if len(code) == 0 || len(confirmationCode) == 0 {
		return nil, errPasswordlessClientMissingCode.Errorf("no code provided")
	}

	cacheKey := fmt.Sprintf(passwordlessKeyPrefix, code)
	jsonData, err := c.cache.Get(ctx, cacheKey)
	if err != nil {
		return nil, errPasswordlessClientInternal.Errorf("cache error: %s", err)
	}

	var codeEntry PasswordlessCacheCodeEntry
	err = json.Unmarshal(jsonData, &codeEntry)
	if err != nil {
		return nil, errPasswordlessClientInternal.Errorf("failed to parse entry from passwordless cache: %w - entry: %s", err, string(jsonData))
	}

	if subtle.ConstantTimeCompare([]byte(codeEntry.ConfirmationCode), []byte(confirmationCode)) != 1 {
		return nil, errPasswordlessClientInvalidConfirmationCode
	}

	ok, err := c.loginAttempts.Validate(ctx, codeEntry.Email)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, errPasswordlessClientTooManyLoginAttempts.Errorf("too many consecutive incorrect login attempts for user - login for user temporarily blocked")
	}

	if err := c.loginAttempts.Reset(ctx, codeEntry.Email); err != nil {
		c.log.Warn("could not reset login attempts", "err", err, "username", codeEntry.Email)
	}

	usr, err := c.userService.GetByEmail(ctx, &user.GetUserByEmailQuery{Email: codeEntry.Email})
	if err != nil && !errors.Is(err, user.ErrUserNotFound) {
		return nil, errPasswordlessClientInternal.Errorf("error retreiving user by email: %w - email: %s", err, codeEntry.Email)
	}

	if usr == nil {
		tempUsers, err := c.tempUserService.GetTempUsersQuery(ctx, &tempuser.GetTempUsersQuery{Email: codeEntry.Email, Status: tempuser.TmpUserInvitePending})
		if err != nil {
			return nil, err
		}
		if tempUsers == nil {
			return nil, errPasswordlessClientInvalidEmail.Errorf("no user or invite found with email %s", codeEntry.Email)
		}

		createUserCmd := user.CreateUserCommand{
			Email: codeEntry.Email,
			Login: form.Username,
			Name:  form.Name,
		}

		// TODO: use user sync hook to create user
		usr, err = c.userService.Create(ctx, &createUserCmd)
		if err != nil {
			return nil, err
		}

		for _, tempUser := range tempUsers {
			if err := c.tempUserService.UpdateTempUserStatus(ctx, &tempuser.UpdateTempUserStatusCommand{Code: tempUser.Code, Status: tempuser.TmpUserCompleted}); err != nil {
				return nil, err
			}
		}
	}

	// delete cache entry with code as key
	err = c.cache.Delete(ctx, cacheKey)
	if err != nil {
		return nil, errPasswordlessClientInternal.Errorf("failed to delete entry from passwordless cache: %w - key: %s", err, cacheKey)
	}

	// delete cache entry with email as key
	cacheKey = fmt.Sprintf(passwordlessKeyPrefix, codeEntry.Email)
	err = c.cache.Delete(ctx, cacheKey)
	if err != nil {
		return nil, errPasswordlessClientInternal.Errorf("failed to delete entry from passwordless cache: %w - key: %s", err, cacheKey)
	}

	// user was found so set auth module in req metadata
	r.SetMeta(authn.MetaKeyAuthModule, login.PasswordlessAuthModule)

	return &authn.Identity{
		ID:              strconv.FormatInt(usr.ID, 10),
		Type:            claims.TypeUser,
		OrgID:           r.OrgID,
		ClientParams:    authn.ClientParams{FetchSyncedUser: true, SyncPermissions: true},
		AuthenticatedBy: login.PasswordlessAuthModule,
	}, nil
}
