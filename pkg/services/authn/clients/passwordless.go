package clients

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
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
	errInvalidConfirmationCode = errutil.Unauthorized("passwordless-auth.invalid", errutil.WithPublicMessage("Invalid code"))
	errPasswordlessAuthFailed  = errutil.Unauthorized("passwordless-auth.failed", errutil.WithPublicMessage("Invalid code"))
)

const passwordlessKeyPrefix = "passwordless-%s"

var _ authn.RedirectClient = new(Passwordless)

func ProvidePasswordless(cfg *setting.Cfg, loginAttempts loginattempt.Service, userService user.Service, tempUserService tempuser.Service, notificationService notifications.Service, cache remotecache.CacheStorage) *Passwordless {
	return &Passwordless{cfg, loginAttempts, userService, tempUserService, notificationService, cache, log.New("authn.passwordless")}
}

type PasswordlessCacheEntry struct {
	Email            string `json:"email"`
	ConfirmationCode string `json:"confirmation_code"`
	SentDate         string `json:"sent_date"`
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
}

// Authenticate implements authn.Client.
func (c *Passwordless) Authenticate(ctx context.Context, r *authn.Request) (*authn.Identity, error) {
	var form PasswordlessForm
	if err := web.Bind(r.HTTPRequest, &form); err != nil {
		return nil, err
	}

	return c.authenticatePasswordless(ctx, r, form.Code, form.ConfirmationCode)
}

// RedirectURL implements authn.RedirectClient.
func (c *Passwordless) RedirectURL(ctx context.Context, r *authn.Request) (*authn.Redirect, error) {
	var form EmailForm
	if err := web.Bind(r.HTTPRequest, &form); err != nil {
		return nil, err
	}

	var (
		code string
		err  error
	)
	code, err = c.startPasswordless(ctx, form.Email)
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
	// TODO: ratelimit on email as well (is there a record for this email in the last x minutes?) - return success message, but don't send email

	// 1. check if is existing user with email or user invite with email
	var existingUser *user.User
	var tempUser []*tempuser.TempUserDTO
	var err error

	if !util.IsEmail(email) {
		return "", errPasswordlessAuthFailed.Errorf("invalid email %s", email)
	}

	// TODO: colin - check passwordless cache if user has already been sent a passwordless link

	existingUser, err = c.userService.GetByEmail(ctx, &user.GetUserByEmailQuery{Email: email})
	if err != nil {
		return "", err
	}

	if existingUser == nil {
		// TODO: colin - set Status in GetTempUsersQuery so that revoked invites are ignored
		tempUser, err = c.tempUserService.GetTempUsersQuery(ctx, &tempuser.GetTempUsersQuery{Email: email})
		if err != nil {
			return "", err
		}
		if tempUser == nil {
			return "", errPasswordlessAuthFailed.Errorf("no user found with email %s", email)
		}
	} else {
		// 2. if existing user, send email with passwordless link
		alphabet := []byte("BCDFGHJKLMNPQRSTVWXZ")
		confirmationCode, err := util.GetRandomString(8, alphabet...)
		if err != nil {
			return "", err
		}
		code, err := util.GetRandomString(32)
		if err != nil {
			return "", err
		}

		c.log.Info("code: ", code)
		c.log.Info("confirmation code: ", confirmationCode)

		// TODO: colin - implement send email with magic link
		emailCmd := notifications.SendEmailCommand{
			To:       []string{email},
			Template: "passwordless_verify_existing_user",
			Data: map[string]any{
				"Email":            email,
				"ConfirmationCode": confirmationCode,
				"Code":             code,
				// TODO: send the expiration date/time as well in the email
			},
		}

		err = c.notificationService.SendEmailCommandHandler(ctx, &emailCmd)
		if err != nil {
			return "", err
		}

		value := &PasswordlessCacheEntry{
			Email:            email,
			ConfirmationCode: confirmationCode,
			SentDate:         time.Now().Format(time.RFC3339),
		}
		valueBytes, err := json.Marshal(value)
		if err != nil {
			return "", err
		}

		expire := time.Duration(20) * time.Minute // make it configurable and mention this in the email
		cacheKey := fmt.Sprintf(passwordlessKeyPrefix, code)
		c.cache.Set(ctx, cacheKey, valueBytes, expire)

		return code, nil
	}

	if tempUser != nil {
		// 3. if temp user, re-send invite with passwordless link
	}
	return "", nil
}

func (c *Passwordless) authenticatePasswordless(ctx context.Context, r *authn.Request, code string, confirmationCode string) (*authn.Identity, error) {
	// TODO: colin - validate login attempts for email instead of username

	// ok, err := c.loginAttempts.Validate(ctx, username)
	// if err != nil {
	// 	return nil, err
	// }
	// if !ok {
	// 	return nil, errPasswordlessAuthFailed.Errorf("too many consecutive incorrect login attempts for user - login for user temporarily blocked")
	// }

	if len(code) == 0 || len(confirmationCode) == 0 {
		return nil, errPasswordlessAuthFailed.Errorf("no code provided")
	}

	cacheKey := fmt.Sprintf(passwordlessKeyPrefix, code)
	jsonData, err := c.cache.Get(ctx, cacheKey)
	if err != nil {
		return nil, err
	}

	var entry PasswordlessCacheEntry
	err = json.Unmarshal(jsonData, &entry)
	if err != nil {
		return nil, fmt.Errorf("failed to parse entry from passwordless cache: %w - entry: %s", err, string(jsonData))
	}

	if subtle.ConstantTimeCompare([]byte(entry.ConfirmationCode), []byte(confirmationCode)) != 1 {
		return nil, errInvalidConfirmationCode
	}

	err = c.cache.Delete(ctx, cacheKey)
	if err != nil {
		return nil, err
	}

	usr, err := c.userService.GetByEmail(ctx, &user.GetUserByEmailQuery{Email: entry.Email})
	if err != nil {
		return nil, err
	}

	// user was found so set auth module in req metadata
	r.SetMeta(authn.MetaKeyAuthModule, "passwordless")

	return &authn.Identity{
		ID:              identity.NewTypedID(identity.TypeUser, usr.ID),
		OrgID:           r.OrgID,
		ClientParams:    authn.ClientParams{FetchSyncedUser: true, SyncPermissions: true},
		AuthenticatedBy: login.PasswordlessAuthModule,
	}, nil
}
