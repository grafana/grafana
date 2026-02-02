package sync

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"

	claims "github.com/grafana/authlib/types"

	"github.bmc.com/DSOM-ADE/authz-go"
	bmc "github.com/grafana/grafana/pkg/api/bmc"
	"github.com/grafana/grafana/pkg/api/bmc/bhd_rbac/bhd_role"
	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/msp"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/team"
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
)

var (
	errUsersQuotaReached = errors.New("users quota reached")
	errGettingUserQuota  = errors.New("error getting user quota")
	errSignupNotAllowed  = errors.New("system administrator has disabled signup")
)

func ProvideUserSync(userService user.Service, userProtectionService login.UserProtectionService, authInfoService login.AuthInfoService,
	quotaService quota.Service, tracer tracing.Tracer, features featuremgmt.FeatureToggles,
	// BMC Code: Next Line, Adding db service
	db db.DB,
	teamService team.Service,
	teamPermissionService accesscontrol.TeamPermissionsService,
) *UserSync {
	return &UserSync{
		userService:           userService,
		authInfoService:       authInfoService,
		userProtectionService: userProtectionService,
		quotaService:          quotaService,
		log:                   log.New("user.sync"),
		tracer:                tracer,
		features:              features,
		// BMC Code: Below lines for this struct
		db:                    db,
		teamService:           teamService,
		teamPermissionService: teamPermissionService,
	}
}

type UserSync struct {
	userService           user.Service
	authInfoService       login.AuthInfoService
	userProtectionService login.UserProtectionService
	quotaService          quota.Service
	log                   log.Logger
	tracer                tracing.Tracer
	features              featuremgmt.FeatureToggles
	// BMC Change: Below lines
	db                    db.DB
	teamService           team.Service
	teamPermissionService accesscontrol.TeamPermissionsService
}

// SyncUserHook syncs a user with the database
func (s *UserSync) SyncUserHook(ctx context.Context, id *authn.Identity, r *authn.Request) error {
	ctx, span := s.tracer.Start(ctx, "user.sync.SyncUserHook")
	defer span.End()

	if !id.ClientParams.SyncUser {
		return nil
	}

	// Does user exist in the database?
	// BMC Code: Next line Inline to add r authn.Request
	usr, userAuth, err := s.getUser(ctx, id, r)
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
		// BMC Code: Next line Inline to add r authn.Request
		usr, err = s.createUser(ctx, id, r)

		// There is a possibility for a race condition when creating a user. Most clients will probably not hit this
		// case but others will. The one we have seen this issue for is auth proxy. First time a new user loads grafana
		// several requests can get "user.ErrUserNotFound" at the same time but only one of the request will be allowed
		// to actually create the user, resulting in all other requests getting "user.ErrUserAlreadyExists". So we can
		// just try to fetch the user one more to make the other request work.
		if errors.Is(err, user.ErrUserAlreadyExists) {
			usr, _, err = s.getUser(ctx, id, r)
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
	go func(userID int64) {
		defer func() {
			if err := recover(); err != nil {
				s.log.Error("Panic during user last seen sync", "err", err)
			}
		}()

		if err := s.userService.UpdateLastSeenAt(goCtx,
			&user.UpdateUserLastSeenAtCommand{UserID: userID, OrgID: r.OrgID}); err != nil &&
			!errors.Is(err, user.ErrLastSeenUpToDate) {
			s.log.Error("Failed to update last_seen_at", "err", err, "userId", userID)
		}
	}(userID)

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

	// If a user does not a connection to a specific auth module, create it.
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

	if errProtection := s.userProtectionService.AllowUserMapping(usr, id.AuthenticatedBy); errProtection != nil {
		return errUserProtection.Errorf("user mapping not allowed: %w", errProtection)
	}
	// sync user info
	updateCmd := &user.UpdateUserCommand{
		UserID: usr.ID,
	}

	needsUpdate := false
	// Bmc Code Start -  Since Portal does not allow Login update, Dashboards will follow the same
	// if id.Login != "" && id.Login != usr.Login {
	// 	updateCmd.Login = id.Login
	// 	usr.Login = id.Login
	// 	needsUpdate = true
	// }
	// Bmc code end

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

	if needsUpdate {
		s.log.FromContext(ctx).Debug("Syncing user info", "id", id.ID, "update", fmt.Sprintf("%v", updateCmd))
		if err := s.userService.Update(ctx, updateCmd); err != nil {
			return err
		}
	}

	return s.upsertAuthConnection(ctx, usr.ID, id, userAuth == nil)
}

// BMC Code: Next line inline to add r authn.Request argument
func (s *UserSync) createUser(ctx context.Context, id *authn.Identity, r *authn.Request) (*user.User, error) {
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

	// BMC Changes - START
	userId, _ := strconv.ParseInt(r.DecodedToken.UserID, 10, 64)
	// BMC Changes - END

	usr, err := s.userService.Create(ctx, &user.CreateUserCommand{
		Id:           userId,
		Login:        id.Login,
		Email:        id.Email,
		Name:         id.Name,
		IsAdmin:      isAdmin,
		SkipOrgSetup: len(id.OrgRoles) > 0,
		// BMC Code: Adding org id from JWT token
		OrgID: r.OrgID,
	})
	if err != nil {
		return nil, err
	}

	if err := s.upsertAuthConnection(ctx, usr.ID, id, true); err != nil {
		return nil, err
	}

	return usr, nil
}

// BMC Change: Inline to add r argument
func (s *UserSync) getUser(ctx context.Context, identity *authn.Identity, r *authn.Request) (*user.User, *login.UserAuth, error) {
	ctx, span := s.tracer.Start(ctx, "user.sync.getUser")
	defer span.End()
	// Check auth info fist
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

// BMC Code : Starts
func (s *UserSync) CheckIfUserSynced(ctx context.Context, id *authn.Identity, r *authn.Request) error {
	if r.HTTPRequest == nil {
		return nil
	}
	encodedJWTToken := r.HTTPRequest.Header.Get("X-JWT-Token")
	if encodedJWTToken == "" {
		if setting.Env != setting.Dev {
			s.log.Error("No JWT Token found in request header")
		}
		return nil
	}

	// Below check is mostly for render call (report generation)
	if r.DecodedToken == nil {
		decodedToken, err := authz.Authorize(encodedJWTToken)
		if err != nil {
			s.log.Error("Error decoding the token", err.Error())
			return err
		}
		r.DecodedToken = decodedToken
	}

	ImsUserID, err := strconv.ParseInt(r.DecodedToken.UserID, 10, 64)
	if err != nil {
		s.log.Error("Failed to parse UserID from decoded JWT Token")
		return nil
	}
	signedInUser := id.SignedInUser()
	if r.DecodedToken != nil && ImsUserID != signedInUser.UserID {
		s.log.Info("User ID from request is not in sync with IMS - removing user", "UserID", signedInUser.UserID)
		removeUnsyncedUser := user.DeleteUserCommand{
			UserID: signedInUser.UserID,
		}
		if err := s.userService.Delete(ctx, &removeUnsyncedUser); err != nil {
			s.log.Error("Failed to remove unsynced user", "err", err.Error())
			s.log.Error("User sync is not complete", "UserID", signedInUser.UserID)
			return nil
		}
		s.log.Info("User sync complete", "UserID", signedInUser.UserID)
	} else {
		s.log.Debug("User ID from request is in sync with IMS", "UserID", signedInUser.UserID)
	}
	return nil
}

func (s *UserSync) BHDRoleUpdate(ctx context.Context, id *authn.Identity, r *authn.Request) error {
	if r.HTTPRequest == nil {
		return nil
	}
	signedInUser := id.SignedInUser()
	//s.log.Debug("RBAC : Update BHD Role in User context", "UserId", signedInUser.UserID)
	if id.OrgRoles == nil {
		id.OrgRoles = map[int64]org.RoleType{}
	}

	/**
		Although '*' users are synced as admins in dashboard, a separate check is introduced explicitly
		to address scenarios where dashboard admins delete '*' users' roles from the dashboard role page.
	**/
	if (r.DecodedToken != nil && bmc.ContainsLower(r.DecodedToken.Permissions, string('*'))) || *id.IsGrafanaAdmin {
		s.log.Debug("RBAC : Administrator User", "UserId", signedInUser.UserID)
		id.OrgRoles[id.OrgID] = org.RoleAdmin
		id.BHDRoles = make([]int64, 0)
		id.BHDRoles = append(id.BHDRoles, 1)
		//s.log.Debug("RBAC : Fetching BHD Roles", "UserId", signedInUser.UserID)
		roles, err := bhd_role.GetBHDRoleIdByUserId(ctx, s.db.WithDbSession, signedInUser.UserID)
		s.log.Debug("RBAC : Fetched BHD Roles", "UserId", signedInUser.UserID, "Roles", roles)
		if (err != nil || len(roles) == 0) && (setting.Env != setting.Dev) {
			s.log.Warn("RBAC : Failed to get bhd roles", "UserId", signedInUser.UserID, "error", err)
		} else {
			id.BHDRoles = append(id.BHDRoles, roles...)
		}

	} else {
		var roles = make([]int64, 0)
		//s.log.Debug("RBAC : Fetching BHD Roles", "UserId", signedInUser.UserID)
		roles, err := bhd_role.GetBHDRoleIdByUserId(ctx, s.db.WithDbSession, signedInUser.UserID)
		s.log.Debug("RBAC : Fetched BHD Roles", "UserId", signedInUser.UserID, "Roles", roles)
		if (err != nil || len(roles) == 0) && (setting.Env != setting.Dev) {
			s.log.Warn("RBAC : Failed to get bhd roles", "UserId", signedInUser.UserID, "error", err)
			err = fallbacktoJwt(ctx, id, r.DecodedToken)
			if err != nil {
				s.log.Error("RBAC : Dashboard permissions are missing", "UserId", signedInUser.UserID, "error", err)
				return err
			}
			s.log.Debug("RBAC : Updated Org Role in context from jwt", "UserId", signedInUser.UserID)
		} else {
			id.BHDRoles = roles
			if bmc.ContainsInt(roles, 1) {
				id.OrgRoles[id.OrgID] = org.RoleAdmin
			} else if bmc.ContainsInt(roles, 2) {
				id.OrgRoles[id.OrgID] = org.RoleEditor
			} else {
				id.OrgRoles[id.OrgID] = org.RoleViewer
			}
			s.log.Debug("RBAC : Updated Org Role in context", "UserId", signedInUser.UserID, "Roles", id.OrgRoles[id.OrgID])
		}
	}
	return nil
}

func (s *UserSync) TeamSync(ctx context.Context, id *authn.Identity, r *authn.Request) error {
	//check if User belongs to External Org and set the request context
	if r.DecodedToken != nil {
		s.checkIfUserFromExternalOrg(ctx, id, r.DecodedToken)
		// Re-sync the user details from IMS
		s.UpdateTeamMembership(ctx, id, r.DecodedToken.Groups)
	}
	return nil
}

func fallbacktoJwt(ctx context.Context, id *authn.Identity, jwtTokenDetails *authz.UserInfo) error {
	var roles = make([]int64, 0)
	if jwtTokenDetails == nil {
		return authn.ErrInvalidPermission
	}
	sort.Strings(jwtTokenDetails.Permissions)
	if bmc.ContainsLower(jwtTokenDetails.Permissions, bmc.ReportingViewer) {
		roles = append(roles, 3)
		id.BHDRoles = roles
		id.OrgRoles[id.OrgID] = org.RoleViewer
	} else {
		return authn.ErrInvalidPermission
	}
	return nil
}

func updateRole(ctx context.Context, id *authn.Identity, jwtTokenDetails *authz.UserInfo) {
	sort.Strings(jwtTokenDetails.Permissions)

	if bmc.ContainsLower(jwtTokenDetails.Permissions, bmc.ReportingViewer) {
		id.OrgRoles[id.OrgID] = org.RoleViewer
	}
	if bmc.ContainsLower(jwtTokenDetails.Permissions, bmc.ReportingEditor) {
		id.OrgRoles[id.OrgID] = org.RoleEditor
	}
	if bmc.ContainsLower(jwtTokenDetails.Permissions, bmc.ReportingAdmin) || bmc.ContainsLower(jwtTokenDetails.Permissions, string('*')) {
		id.OrgRoles[id.OrgID] = org.RoleAdmin
	}
}

func (s *UserSync) checkIfUserFromExternalOrg(ctx context.Context, id *authn.Identity, jwtTokenDetails *authz.UserInfo) {
	// For testing purpose
	// msp.MockMspCtx(ctx)
	// return

	usr := id.SignedInUser()
	if jwtTokenDetails.Organizations == nil {
		s.log.Debug("User is not associated with external organizations", "TenantID", id.OrgID, "UserID", usr.UserID)
		id.HasExternalOrg = false
		id.IsUnrestrictedUser = false
		id.MspOrgs = []string{}
		return
	}
	if jwtTokenDetails.Organizations != nil && len(jwtTokenDetails.Organizations) == 0 {
		s.log.Debug("Its MSP teanant - User is associated with external organizations but has no orgs associated to it", "TenantID", id.OrgID, "UserID", usr.UserID)
		id.HasExternalOrg = true
		//DRJ71-14431 : In case of ITOM MSP, org array in jwt could be empty for unrestricted user.
		//When admin provides unrestricted access to users, without assigning any org, that user was getting treated as non-msp user
		id.IsUnrestrictedUser = jwtTokenDetails.AllOrgAccess
		id.MspOrgs = []string{}
		return
	}

	id.MspOrgs = append(id.MspOrgs, jwtTokenDetails.Organizations...)
	if jwtTokenDetails.AllOrgAccess {
		id.IsUnrestrictedUser = true
	} else {
		id.IsUnrestrictedUser = false
	}

	if jwtTokenDetails.MspTenantId == jwtTokenDetails.Tenant_Id {
		id.SubTenantId = jwtTokenDetails.SubTenantId
	}

	id.HasExternalOrg = true
	//MSP: Create Unrestricated Team
	s.CreateUnrestrictedTeam(ctx, id)
	//MSP : code end
	s.log.Debug("User is associated with external organizations",
		"TenantID", id.OrgID, "UserID", usr.UserID, "HasExternalOrg", id.HasExternalOrg,
		"IsUnrestricatedUser", id.IsUnrestrictedUser, "Orgs", strings.Join(jwtTokenDetails.Organizations, ","),
	)
}

func (s *UserSync) CreateUnrestrictedTeam(ctx context.Context, id *authn.Identity) {
	usr := id.SignedInUser()
	logger := s.log.New("userId", usr.UserID, "orgId", id.OrgID)

	if !id.HasExternalOrg {
		return
	}
	logger.Debug("Trying to create UA team", usr.UserID, "orgId", id.OrgID)

	mspUnrestrictedTeamID := msp.CreateTeamIDWithOrgString(id.OrgID, "00")
	query := &team.GetTeamByIDQuery{
		OrgID: id.OrgID,
		ID:    mspUnrestrictedTeamID,
	}

	_, err := s.teamService.GetTeamByID(ctx, query)

	if err == nil {
		return
	}

	if !errors.Is(err, team.ErrTeamNotFound) {
		return
	}
	logger.Debug("UA team not exist, creating UA teams", "user", usr.UserID, "orgId", id.OrgID)

	// Since type=0 for grafana Team
	s.teamService.CreateTeam(ctx, "Unrestricted Access", "", id.OrgID, mspUnrestrictedTeamID, 0, true)
	logger.Debug("UA team created successfully", "user", usr.UserID, "orgId", id.OrgID)

}

func (s *UserSync) UpdateTeamMembership(ctx context.Context, id *authn.Identity, imsGroups []string) {
	usr := id.SignedInUser()
	logger := s.log.New("userId", usr.UserID, "orgId", id.OrgID)
	logger.Debug("Re-syncing user teams", "user", usr.UserID, "org", id.OrgID)

	// combine the list of groups + msp grouporgs
	groupIds := imsGroups

	// ToDo_GF_10.4.2: Below block is copied from GetMspOrgIdsFromCtx, try to remove the redudancy
	// mspOrgsIdsList := msp.GetMspOrgIdsFromCtx(ctx)
	mspOrgsIdsList := make([]int64, 0)
	for _, mspOrgId := range id.MspOrgs {
		mspTeamID := msp.CreateTeamIDWithOrgString(id.OrgID, mspOrgId)
		mspOrgsIdsList = append(mspOrgsIdsList, mspTeamID)
	}
	if id.IsUnrestrictedUser {
		mspTeamID := msp.CreateTeamIDWithOrgString(id.OrgID, "00")
		mspOrgsIdsList = append(mspOrgsIdsList, mspTeamID)
	}

	mspOrgIds := make([]string, len(mspOrgsIdsList))
	for _, mspOrgId := range mspOrgsIdsList {
		mspOrgIdStr := strconv.FormatInt(mspOrgId, 10)
		groupIds = append(groupIds, mspOrgIdStr)
	}
	teamIds := append(groupIds, mspOrgIds...)
	hasNoChanges := s.RemoveFromTeam(ctx, id, teamIds)
	if hasNoChanges {
		return
	}
	//loop to add team membership for teams in jwt
	for _, teamIdItem := range teamIds {
		teamId, _ := strconv.ParseInt(teamIdItem, 10, 64)

		cmd := team.AddTeamMemberCommand{
			UserID: usr.UserID,
		}

		teamIDString := strconv.FormatInt(teamId, 10)

		if _, err := s.teamPermissionService.SetUserPermission(ctx, id.OrgID, accesscontrol.User{ID: cmd.UserID}, teamIDString, getPermissionName(cmd.Permission)); err != nil {
			logger.Debug("Failed to add team member", "team", teamId)
			continue
		}
	}
}

func (s *UserSync) RemoveFromTeam(ctx context.Context, id *authn.Identity, teamIds []string) bool {
	usr := id.SignedInUser()
	logger := s.log.New("userId", usr.UserID, "orgId", id.OrgID)
	//Fetch team list from DB for this user
	query := &team.SearchTeamsQuery{
		OrgID:        id.OrgID,
		SignedInUser: usr,
		UserIDFilter: &usr.UserID,
	}

	resultTeams, err := s.teamService.SearchTeams(ctx, query)
	if err != nil {
		logger.Error("Failed to get user teams", "error", err.Error())
		return false
	}

	existingTeamIds := make([]int64, len(resultTeams.Teams))
	for _, t := range resultTeams.Teams {
		existingTeamIds = append(existingTeamIds, t.ID)
	}
	currentImsTeamIds := make([]int64, len(teamIds))
	for _, tId := range teamIds {
		teamId, _ := strconv.ParseInt(tId, 10, 64)
		currentImsTeamIds = append(currentImsTeamIds, teamId)
	}

	logger.Debug("Team list from DB", "currentImsTeamIds", currentImsTeamIds, "existingTeamIds", existingTeamIds)

	hasNoChanges := bmc.SlicesAreEqual(currentImsTeamIds, existingTeamIds)
	if hasNoChanges {
		return true
	}

	logger.Debug("Team membership has changes")
	for _, teamId := range existingTeamIds {
		permsIdStr := strconv.FormatInt(teamId, 10)
		logger.Debug("Removing user from team", "team", permsIdStr)

		_, err := s.teamPermissionService.SetUserPermission(ctx, id.OrgID, accesscontrol.User{ID: usr.UserID}, permsIdStr, "")
		if err != nil {
			logger.Debug("Failed to remove member from Team", "team", permsIdStr)
			continue
		}
		logger.Debug("Successfully removed user from team", "team", permsIdStr)
	}

	return false
}

func getPermissionName(permission team.PermissionType) string {
	permissionName := permission.String()
	// Team member permission is 0, which maps to an empty string.
	// However, we want the team permission service to display "Member" for team members. This is a hack to make it work.
	if permissionName == "" {
		permissionName = "Member"
	}
	return permissionName
}

// BMC Code: Ends

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
