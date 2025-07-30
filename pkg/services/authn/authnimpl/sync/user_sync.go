package sync

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"sync/atomic"

	claims "github.com/grafana/authlib/types"
	"go.opentelemetry.io/otel/attribute"
	"golang.org/x/sync/singleflight"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/apiserver/client"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/scimutil"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	errUserSignupDisabled = errutil.Unauthorized(
		"user.sync.signup-disabled",
		errutil.WithPublicMessage("Sign up is disabled"),
	)
	errSyncUserForbidden = errutil.Forbidden(
		"user.sync.forbidden",
		errutil.WithPublicMessage("User sync forbidden"),
	)
	errSyncUserInternal = errutil.Internal(
		"user.sync.internal",
		errutil.WithPublicMessage("User sync failed"),
	)
	errUserProtection = errutil.Forbidden(
		"user.sync.protected-role",
		errutil.WithPublicMessage("Unable to sync due to protected role"),
	)
	errFetchingSignedInUser = errutil.Internal(
		"user.sync.fetch",
		errutil.WithPublicMessage("Insufficient information to authenticate user"),
	)
	errFetchingSignedInUserNotFound = errutil.Unauthorized(
		"user.sync.fetch-not-found",
		errutil.WithPublicMessage("User not found"),
	)
	errMismatchedExternalUID = errutil.Unauthorized(
		"user.sync.mismatched-externalUID",
		errutil.WithPublicMessage("Mismatched provisioned identity"),
	)
	errEmptyExternalUID = errutil.Unauthorized(
		"user.sync.empty-externalUID",
		errutil.WithPublicMessage("Empty externalUID"),
	)
	errUnableToRetrieveUserOrAuthInfo = errutil.Internal(
		"user.sync.unable-to-retrieve-user-or-authinfo",
		errutil.WithPublicMessage("Unable to retrieve user or authInfo for validation"),
	)
	errUnableToRetrieveUser = errutil.Internal(
		"user.sync.unable-to-retrieve-user",
		errutil.WithPublicMessage("Unable to retrieve user for validation"),
	)
	errUserNotProvisioned = errutil.Forbidden(
		"user.sync.user-not-provisioned",
		errutil.WithPublicMessage("User is not provisioned"),
	)
	errUserExternalUIDMismatch = errutil.Unauthorized(
		"user.sync.user-externalUID-mismatch",
		errutil.WithPublicMessage("User externalUID mismatch"),
	)
)

var (
	errUsersQuotaReached = errors.New("users quota reached")
	errGettingUserQuota  = errors.New("error getting user quota")
	errSignupNotAllowed  = errors.New("system administrator has disabled signup")
)

// StaticSCIMConfig represents the static SCIM configuration from config.ini
type StaticSCIMConfig struct {
	IsUserProvisioningEnabled bool
	RejectNonProvisionedUsers bool
}

func ProvideUserSync(userService user.Service, userProtectionService login.UserProtectionService, authInfoService login.AuthInfoService,
	quotaService quota.Service, tracer tracing.Tracer, features featuremgmt.FeatureToggles, cfg *setting.Cfg,
	k8sClient client.K8sHandler,
) *UserSync {
	scimSection := cfg.Raw.Section("auth.scim")
	staticConfig := &StaticSCIMConfig{
		IsUserProvisioningEnabled: scimSection.Key("user_sync_enabled").MustBool(false),
		RejectNonProvisionedUsers: scimSection.Key("reject_non_provisioned_users").MustBool(false),
	}

	return &UserSync{
		isUserProvisioningEnabled: staticConfig.IsUserProvisioningEnabled,
		rejectNonProvisionedUsers: staticConfig.RejectNonProvisionedUsers,
		userService:               userService,
		authInfoService:           authInfoService,
		userProtectionService:     userProtectionService,
		quotaService:              quotaService,
		log:                       log.New("user.sync"),
		tracer:                    tracer,
		features:                  features,
		lastSeenSF:                &singleflight.Group{},
		scimUtil:                  scimutil.NewSCIMUtil(k8sClient),
		staticConfig:              staticConfig,
	}
}

type UserSync struct {
	isUserProvisioningEnabled bool
	rejectNonProvisionedUsers bool
	userService               user.Service
	authInfoService           login.AuthInfoService
	userProtectionService     login.UserProtectionService
	quotaService              quota.Service
	log                       log.Logger
	tracer                    tracing.Tracer
	features                  featuremgmt.FeatureToggles
	lastSeenSF                *singleflight.Group
	scimUtil                  *scimutil.SCIMUtil
	staticConfig              *StaticSCIMConfig
	scimSuccessfulLogin       atomic.Bool
}

// GetUsageStats implements registry.ProvidesUsageStats
func (s *UserSync) GetUsageStats(ctx context.Context) map[string]any {
	stats := map[string]any{}
	if s.scimSuccessfulLogin.Load() {
		stats["stats.features.scim.has_successful_login.count"] = 1
	} else {
		stats["stats.features.scim.has_successful_login.count"] = 0
	}
	return stats
}

// ValidateUserProvisioningHook validates if a user should be allowed access based on provisioning status and configuration
func (s *UserSync) ValidateUserProvisioningHook(ctx context.Context, currentIdentity *authn.Identity, _ *authn.Request) error {
	log := s.log.FromContext(ctx).New("auth_module", currentIdentity.AuthenticatedBy, "auth_id", currentIdentity.AuthID)

	if !currentIdentity.ClientParams.SyncUser {
		return nil
	}

	log.Debug("Validating user provisioning")
	ctx, span := s.tracer.Start(ctx, "user.sync.ValidateUserProvisioningHook")
	defer span.End()

	if s.skipProvisioningValidation(ctx, currentIdentity) {
		log.Debug("Skipping user provisioning validation")
		return nil
	}

	// In order to guarantee the provisioned user is the same as the identity,
	// we must validate the authinfo.ExternalUID with the identity.ExternalUID

	// Retrieve user and authinfo from database
	usr, authInfo, err := s.getUser(ctx, currentIdentity)
	if err != nil {
		if errors.Is(err, user.ErrUserNotFound) {
			return nil
		}
		log.Error("Failed to fetch user for validation", "error", err)
		return errUnableToRetrieveUserOrAuthInfo.Errorf("unable to retrieve user or authInfo for validation")
	}

	if usr == nil {
		log.Error("Failed to fetch user for validation", "error", err)
		return errUnableToRetrieveUser.Errorf("unable to retrieve user for validation")
	}

	if usr.IsProvisioned {
		if authInfo.ExternalUID == "" || authInfo.ExternalUID != currentIdentity.ExternalUID {
			log.Error("The provisioned user.ExternalUID does not match the authinfo.ExternalUID")
			return errUserExternalUIDMismatch.Errorf("the provisioned user.ExternalUID does not match the authinfo.ExternalUID")
		}
		log.Debug("User is provisioned, access granted")
		s.scimSuccessfulLogin.Store(true)

		return nil
	}

	// Reject non-provisioned users if configured to do so
	if s.shouldRejectNonProvisionedUsers(ctx, currentIdentity) {
		log.Error("Failed to authenticate user, user is not provisioned")
		return errUserNotProvisioned.Errorf("user is not provisioned")
	}

	return nil
}

func (s *UserSync) skipProvisioningValidation(ctx context.Context, currentIdentity *authn.Identity) bool {
	log := s.log.FromContext(ctx).New("auth_module", currentIdentity.AuthenticatedBy, "auth_id", currentIdentity.AuthID, "id", currentIdentity.ID)

	// Use dynamic SCIM settings if available, otherwise fall back to static config
	effectiveUserSyncEnabled := s.isUserProvisioningEnabled

	if s.scimUtil != nil {
		orgID := currentIdentity.GetOrgID()
		effectiveUserSyncEnabled = s.scimUtil.IsUserSyncEnabled(ctx, orgID, s.staticConfig.IsUserProvisioningEnabled)
	}

	if !effectiveUserSyncEnabled {
		log.Debug("User provisioning is disabled, skipping validation")
		return true
	}

	if currentIdentity.AuthenticatedBy == login.GrafanaComAuthModule {
		log.Debug("User is authenticated via GrafanaComAuthModule, skipping validation")
		return true
	}

	return false
}

func (s *UserSync) shouldRejectNonProvisionedUsers(ctx context.Context, currentIdentity *authn.Identity) bool {
	effectiveRejectNonProvisionedUsers := s.rejectNonProvisionedUsers

	if s.scimUtil != nil {
		orgID := currentIdentity.GetOrgID()
		effectiveRejectNonProvisionedUsers = s.scimUtil.AreNonProvisionedUsersRejected(ctx, orgID, s.staticConfig.RejectNonProvisionedUsers)
	}

	return effectiveRejectNonProvisionedUsers
}

// SyncUserHook syncs a user with the database
func (s *UserSync) SyncUserHook(ctx context.Context, id *authn.Identity, _ *authn.Request) error {
	ctx, span := s.tracer.Start(ctx, "user.sync.SyncUserHook")
	defer span.End()

	if !id.ClientParams.SyncUser {
		return nil
	}

	// Does user exist in the database?
	usr, userAuth, err := s.getUser(ctx, id)
	if err != nil && !errors.Is(err, user.ErrUserNotFound) {
		s.log.FromContext(ctx).Error("Failed to fetch user", "error", err, "auth_module", id.AuthenticatedBy, "auth_id", id.AuthID)
		return errSyncUserInternal.Errorf("unable to retrieve user")
	}

	if errors.Is(err, user.ErrUserNotFound) {
		if !id.ClientParams.AllowSignUp {
			s.log.FromContext(ctx).Warn("Failed to create user, signup is not allowed for module", "auth_module", id.AuthenticatedBy, "auth_id", id.AuthID)
			return errUserSignupDisabled.Errorf("%w", errSignupNotAllowed)
		}

		// create user
		usr, err = s.createUser(ctx, id)

		// There is a possibility for a race condition when creating a user. Most clients will probably not hit this
		// case but others will. The one we have seen this issue for is auth proxy. First time a new user loads grafana
		// several requests can get "user.ErrUserNotFound" at the same time but only one of the request will be allowed
		// to actually create the user, resulting in all other requests getting "user.ErrUserAlreadyExists". So we can
		// just try to fetch the user one more to make the other request work.
		if errors.Is(err, user.ErrUserAlreadyExists) {
			usr, _, err = s.getUser(ctx, id)
		}

		if err != nil {
			s.log.FromContext(ctx).Error("Failed to create user", "error", err, "auth_module", id.AuthenticatedBy, "auth_id", id.AuthID)
			return errSyncUserInternal.Errorf("unable to create user: %w", err)
		}
	} else {
		// update user
		if err := s.updateUserAttributes(ctx, usr, id, userAuth); err != nil {
			s.log.FromContext(ctx).Error("Failed to update user", "error", err, "auth_module", id.AuthenticatedBy, "auth_id", id.AuthID)
			return errSyncUserInternal.Errorf("unable to update user")
		}
	}

	syncUserToIdentity(usr, id)
	return nil
}

func (s *UserSync) FetchSyncedUserHook(ctx context.Context, id *authn.Identity, r *authn.Request) error {
	ctx, span := s.tracer.Start(ctx, "user.sync.FetchSyncedUserHook")
	defer span.End()

	if !id.ClientParams.FetchSyncedUser {
		return nil
	}

	if !id.IsIdentityType(claims.TypeUser, claims.TypeServiceAccount) {
		return nil
	}

	userID, err := id.GetInternalID()
	if err != nil {
		s.log.FromContext(ctx).Warn("got invalid identity ID", "id", id.ID, "err", err)
		return nil
	}

	usr, err := s.userService.GetSignedInUser(ctx, &user.GetSignedInUserQuery{
		UserID: userID,
		OrgID:  r.OrgID,
	})
	if err != nil {
		if errors.Is(err, user.ErrUserNotFound) {
			return errFetchingSignedInUserNotFound.Errorf("%w", err)
		}
		return errFetchingSignedInUser.Errorf("failed to resolve user: %w", err)
	}

	if id.ClientParams.AllowGlobalOrg && id.OrgID == authn.GlobalOrgID {
		usr.Teams = nil
		usr.OrgName = ""
		usr.OrgRole = org.RoleNone
		usr.OrgID = authn.GlobalOrgID
	}

	syncSignedInUserToIdentity(usr, id)
	return nil
}

func (s *UserSync) SyncLastSeenHook(ctx context.Context, id *authn.Identity, r *authn.Request) error {
	ctx, span := s.tracer.Start(ctx, "user.sync.SyncLastSeenHook")
	defer span.End()

	if r.GetMeta(authn.MetaKeyIsLogin) != "" {
		// Do not sync last seen for login requests
		return nil
	}

	if !id.IsIdentityType(claims.TypeUser, claims.TypeServiceAccount) {
		return nil
	}

	userID, err := id.GetInternalID()
	if err != nil {
		s.log.FromContext(ctx).Warn("got invalid identity ID", "id", id.ID, "err", err)
		return nil
	}

	goCtx := context.WithoutCancel(ctx)
	// nolint:dogsled
	_, _, _ = s.lastSeenSF.Do(fmt.Sprintf("%d-%d", id.GetOrgID(), userID), func() (interface{}, error) {
		err := s.userService.UpdateLastSeenAt(goCtx, &user.UpdateUserLastSeenAtCommand{UserID: userID, OrgID: id.GetOrgID()})
		if err != nil && !errors.Is(err, user.ErrLastSeenUpToDate) {
			s.log.Error("Failed to update last_seen_at", "err", err, "userId", userID)
		}
		return nil, nil
	})

	return nil
}

func (s *UserSync) EnableUserHook(ctx context.Context, id *authn.Identity, _ *authn.Request) error {
	ctx, span := s.tracer.Start(ctx, "user.sync.EnableUserHook")
	defer span.End()

	if !id.ClientParams.EnableUser {
		return nil
	}

	if !id.IsIdentityType(claims.TypeUser, claims.TypeServiceAccount) {
		return nil
	}

	userID, err := id.GetInternalID()
	if err != nil {
		s.log.FromContext(ctx).Warn("got invalid identity ID", "id", id.ID, "err", err)
		return nil
	}

	isDisabled := false
	return s.userService.Update(ctx, &user.UpdateUserCommand{UserID: userID, IsDisabled: &isDisabled})
}

func (s *UserSync) upsertAuthConnection(ctx context.Context, userID int64, identity *authn.Identity, createConnection bool) error {
	ctx, span := s.tracer.Start(ctx, "user.sync.upsertAuthConnection")
	defer span.End()

	if identity.AuthenticatedBy == "" {
		return nil
	}

	// If a user does not have a connection to a specific auth module, create it.
	// This can happen when: using multiple auth client where the same user exists in several or
	// changing to new auth client
	if createConnection {
		setAuthInfoCmd := &login.SetAuthInfoCommand{
			UserId:     userID,
			AuthModule: identity.AuthenticatedBy,
			AuthId:     identity.AuthID,
		}

		if !s.features.IsEnabledGlobally(featuremgmt.FlagImprovedExternalSessionHandling) {
			setAuthInfoCmd.OAuthToken = identity.OAuthToken
		}
		return s.authInfoService.SetAuthInfo(ctx, setAuthInfoCmd)
	}

	updateAuthInfoCmd := &login.UpdateAuthInfoCommand{
		UserId:     userID,
		AuthId:     identity.AuthID,
		AuthModule: identity.AuthenticatedBy,
	}

	if !s.features.IsEnabledGlobally(featuremgmt.FlagImprovedExternalSessionHandling) {
		updateAuthInfoCmd.OAuthToken = identity.OAuthToken
	}

	s.log.FromContext(ctx).Debug("Updating auth connection for user", "id", identity.ID)
	return s.authInfoService.UpdateAuthInfo(ctx, updateAuthInfoCmd)
}

func (s *UserSync) updateUserAttributes(ctx context.Context, usr *user.User, id *authn.Identity, userAuth *login.UserAuth) error {
	ctx, span := s.tracer.Start(ctx, "user.sync.updateUserAttributes")
	defer span.End()

	needsConnectionCreation := userAuth == nil

	if errProtection := s.userProtectionService.AllowUserMapping(usr, id.AuthenticatedBy); errProtection != nil {
		return errUserProtection.Errorf("user mapping not allowed: %w", errProtection)
	}
	// sync user info
	updateCmd := &user.UpdateUserCommand{
		UserID: usr.ID,
	}

	needsUpdate := false
	if id.Login != "" && id.Login != usr.Login {
		updateCmd.Login = id.Login
		usr.Login = id.Login
		needsUpdate = true
	}

	if id.Email != "" && id.Email != usr.Email {
		updateCmd.Email = id.Email
		usr.Email = id.Email

		// If we get a new email for a user we need to mark it as non-verified.
		verified := false
		updateCmd.EmailVerified = &verified
		usr.EmailVerified = verified

		needsUpdate = true
	}

	if id.Name != "" && id.Name != usr.Name {
		updateCmd.Name = id.Name
		usr.Name = id.Name
		needsUpdate = true
	}

	// Sync isGrafanaAdmin permission
	if id.IsGrafanaAdmin != nil && *id.IsGrafanaAdmin != usr.IsAdmin {
		updateCmd.IsGrafanaAdmin = id.IsGrafanaAdmin
		usr.IsAdmin = *id.IsGrafanaAdmin
		needsUpdate = true
	}

	span.SetAttributes(
		attribute.String("identity.ID", id.ID),
		attribute.String("identity.ExternalUID", id.ExternalUID),
	)
	if usr.IsProvisioned {
		s.log.Debug("User is provisioned", "id.UID", id.UID)
		needsConnectionCreation = false
		authInfo, err := s.authInfoService.GetAuthInfo(ctx, &login.GetAuthInfoQuery{UserId: usr.ID, AuthModule: id.AuthenticatedBy})
		if err != nil {
			s.log.Error("Error getting auth info for provisioned user", "error", err)
			return err
		}

		if id.ExternalUID == "" {
			s.log.Error("externalUID is empty for provisioned user", "id", id.UID)
			return errEmptyExternalUID.Errorf("externalUID is empty")
		}

		if id.ExternalUID != authInfo.ExternalUID {
			s.log.Error("mismatched externalUID for provisioned user", "provisioned_externalUID", authInfo.ExternalUID, "identity_externalUID", id.ExternalUID)
			return errMismatchedExternalUID.Errorf("externalUID mismatch")
		}
	}

	if needsUpdate {
		finalCmdToExecute := &user.UpdateUserCommand{UserID: usr.ID}
		shouldExecuteUpdate := false

		if !usr.IsProvisioned {
			finalCmdToExecute = updateCmd
			shouldExecuteUpdate = true
			s.log.FromContext(ctx).Debug("Syncing all differing attributes for non-provisioned user", "id", id.ID,
				"login", finalCmdToExecute.Login, "email", finalCmdToExecute.Email, "name", finalCmdToExecute.Name,
				"isGrafanaAdmin", finalCmdToExecute.IsGrafanaAdmin, "emailVerified", finalCmdToExecute.EmailVerified)
		} else {
			if updateCmd.IsGrafanaAdmin != nil {
				finalCmdToExecute.IsGrafanaAdmin = updateCmd.IsGrafanaAdmin
				shouldExecuteUpdate = true
				s.log.FromContext(ctx).Debug("Syncing IsGrafanaAdmin for provisioned user", "id", id.ID, "isAdmin", fmt.Sprintf("%v", *updateCmd.IsGrafanaAdmin))
			}

			if !shouldExecuteUpdate {
				s.log.FromContext(ctx).Debug("SAML attributes differed, but no SCIM-overridable attributes changed for provisioned user", "id", id.ID,
					"login", updateCmd.Login, "email", updateCmd.Email, "name", updateCmd.Name,
					"isGrafanaAdmin", updateCmd.IsGrafanaAdmin, "emailVerified", updateCmd.EmailVerified)
			}
		}

		if shouldExecuteUpdate {
			if err := s.userService.Update(ctx, finalCmdToExecute); err != nil {
				s.log.FromContext(ctx).Error("Failed to update user attributes", "error", err, "id", id.ID, "isProvisioned", usr.IsProvisioned,
					"login", finalCmdToExecute.Login, "email", finalCmdToExecute.Email, "name", finalCmdToExecute.Name,
					"isGrafanaAdmin", finalCmdToExecute.IsGrafanaAdmin, "emailVerified", finalCmdToExecute.EmailVerified)
				return err
			}
		}
	}

	return s.upsertAuthConnection(ctx, usr.ID, id, needsConnectionCreation)
}

func (s *UserSync) createUser(ctx context.Context, id *authn.Identity) (*user.User, error) {
	ctx, span := s.tracer.Start(ctx, "user.sync.createUser")
	defer span.End()

	// FIXME(jguer): this should be done in the user service
	// quota check: we can have quotas on both global and org level
	// therefore we need to query check quota for both user and org services
	for _, srv := range []string{user.QuotaTargetSrv, org.QuotaTargetSrv} {
		limitReached, errLimit := s.quotaService.CheckQuotaReached(ctx, quota.TargetSrv(srv), nil)
		if errLimit != nil {
			s.log.FromContext(ctx).Error("Failed to check quota", "error", errLimit)
			return nil, errSyncUserInternal.Errorf("%w", errGettingUserQuota)
		}
		if limitReached {
			return nil, errSyncUserForbidden.Errorf("%w", errUsersQuotaReached)
		}
	}

	isAdmin := false
	if id.IsGrafanaAdmin != nil {
		isAdmin = *id.IsGrafanaAdmin
	}

	usr, err := s.userService.Create(ctx, &user.CreateUserCommand{
		Login:        id.Login,
		Email:        id.Email,
		Name:         id.Name,
		IsAdmin:      isAdmin,
		SkipOrgSetup: len(id.OrgRoles) > 0,
	})
	if err != nil {
		return nil, err
	}

	if err := s.upsertAuthConnection(ctx, usr.ID, id, true); err != nil {
		return nil, err
	}

	return usr, nil
}

func (s *UserSync) getUser(ctx context.Context, identity *authn.Identity) (*user.User, *login.UserAuth, error) {
	ctx, span := s.tracer.Start(ctx, "user.sync.getUser")
	defer span.End()

	// Check auth info first
	if identity.AuthID != "" && identity.AuthenticatedBy != "" {
		query := &login.GetAuthInfoQuery{AuthId: identity.AuthID, AuthModule: identity.AuthenticatedBy}
		authInfo, errGetAuthInfo := s.authInfoService.GetAuthInfo(ctx, query)

		if errGetAuthInfo != nil && !errors.Is(errGetAuthInfo, user.ErrUserNotFound) {
			return nil, nil, errGetAuthInfo
		}

		if !errors.Is(errGetAuthInfo, user.ErrUserNotFound) {
			usr, errGetByID := s.userService.GetByID(ctx, &user.GetUserByIDQuery{ID: authInfo.UserId})
			if errGetByID == nil {
				return usr, authInfo, nil
			}

			if !errors.Is(errGetByID, user.ErrUserNotFound) {
				return nil, nil, errGetByID
			}

			// if the user connected to user auth does not exist try to clean it up
			if errors.Is(errGetByID, user.ErrUserNotFound) {
				if err := s.authInfoService.DeleteUserAuthInfo(ctx, authInfo.UserId); err != nil {
					s.log.FromContext(ctx).Error("Failed to clean up user auth", "error", err, "auth_module", identity.AuthenticatedBy, "auth_id", identity.AuthID)
				}
			}
		}
	}

	// Check user table to grab existing user
	usr, err := s.lookupByOneOf(ctx, identity.ClientParams.LookUpParams)
	if err != nil {
		return nil, nil, err
	}

	var userAuth *login.UserAuth
	// Special case for generic oauth: generic oauth does not store authID,
	// so we need to find the user first then check for the userAuth connection by module and userID
	if identity.AuthenticatedBy == login.GenericOAuthModule {
		query := &login.GetAuthInfoQuery{AuthModule: identity.AuthenticatedBy, UserId: usr.ID}
		userAuth, err = s.authInfoService.GetAuthInfo(ctx, query)
		if err != nil && !errors.Is(err, user.ErrUserNotFound) {
			return nil, nil, err
		}
	}

	return usr, userAuth, nil
}

func (s *UserSync) lookupByOneOf(ctx context.Context, params login.UserLookupParams) (*user.User, error) {
	ctx, span := s.tracer.Start(ctx, "user.sync.lookupByOneOf")
	defer span.End()

	var usr *user.User
	var err error

	// If not found, try to find the user by email address
	if params.Email != nil && *params.Email != "" {
		usr, err = s.userService.GetByEmail(ctx, &user.GetUserByEmailQuery{Email: *params.Email})
		if err != nil && !errors.Is(err, user.ErrUserNotFound) {
			return nil, err
		}
	}

	// If not found, try to find the user by login
	if usr == nil && params.Login != nil && *params.Login != "" {
		usr, err = s.userService.GetByLogin(ctx, &user.GetUserByLoginQuery{LoginOrEmail: *params.Login})
		if err != nil && !errors.Is(err, user.ErrUserNotFound) {
			return nil, err
		}
	}

	if usr == nil || usr.ID == 0 { // id check as safeguard against returning empty user
		return nil, user.ErrUserNotFound
	}

	return usr, nil
}

// syncUserToIdentity syncs a user to an identity.
// This is used to update the identity with the latest user information.
func syncUserToIdentity(usr *user.User, id *authn.Identity) {
	id.ID = strconv.FormatInt(usr.ID, 10)
	id.UID = usr.UID
	id.Type = claims.TypeUser
	id.Login = usr.Login
	id.Email = usr.Email
	id.Name = usr.Name
	id.EmailVerified = usr.EmailVerified
	id.IsGrafanaAdmin = &usr.IsAdmin
}

// syncSignedInUserToIdentity syncs a user to an identity.
func syncSignedInUserToIdentity(usr *user.SignedInUser, id *authn.Identity) {
	id.UID = usr.UserUID
	id.Name = usr.Name
	id.Login = usr.Login
	id.Email = usr.Email
	id.OrgID = usr.OrgID
	id.OrgName = usr.OrgName
	id.OrgRoles = map[int64]org.RoleType{id.OrgID: usr.OrgRole}
	id.HelpFlags1 = usr.HelpFlags1
	id.Teams = usr.Teams
	id.LastSeenAt = usr.LastSeenAt
	id.IsDisabled = usr.IsDisabled
	id.IsGrafanaAdmin = &usr.IsGrafanaAdmin
	id.EmailVerified = usr.EmailVerified
}
