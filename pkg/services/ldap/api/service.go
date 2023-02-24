package api

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/middleware"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/auth"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/ldap"
	"github.com/grafana/grafana/pkg/services/ldap/multildap"
	"github.com/grafana/grafana/pkg/services/ldap/service"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/supportbundles"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

type Service struct {
	cfg               *setting.Cfg
	userService       user.Service
	authInfoService   login.AuthInfoService
	ldapGroupsService ldap.Groups
	loginService      login.Service
	orgService        org.Service
	sessionService    auth.UserTokenService
	log               log.Logger
	ldapService       service.LDAP
}

func ProvideService(cfg *setting.Cfg, router routing.RouteRegister, accessControl ac.AccessControl,
	userService user.Service, authInfoService login.AuthInfoService, ldapGroupsService ldap.Groups,
	loginService login.Service, orgService org.Service, ldapService service.LDAP,
	sessionService auth.UserTokenService, bundleRegistry supportbundles.Service) *Service {
	s := &Service{
		cfg:               cfg,
		userService:       userService,
		authInfoService:   authInfoService,
		ldapGroupsService: ldapGroupsService,
		loginService:      loginService,
		orgService:        orgService,
		sessionService:    sessionService,
		ldapService:       ldapService,
		log:               log.New("ldap.api"),
	}

	authorize := ac.Middleware(accessControl)
	reqGrafanaAdmin := middleware.ReqGrafanaAdmin

	router.Group("/api/admin", func(adminRoute routing.RouteRegister) {
		adminRoute.Post("/ldap/reload", authorize(reqGrafanaAdmin, ac.EvalPermission(ac.ActionLDAPConfigReload)), routing.Wrap(s.ReloadLDAPCfg))
		adminRoute.Post("/ldap/sync/:id", authorize(reqGrafanaAdmin, ac.EvalPermission(ac.ActionLDAPUsersSync)), routing.Wrap(s.PostSyncUserWithLDAP))
		adminRoute.Get("/ldap/:username", authorize(reqGrafanaAdmin, ac.EvalPermission(ac.ActionLDAPUsersRead)), routing.Wrap(s.GetUserFromLDAP))
		adminRoute.Get("/ldap/status", authorize(reqGrafanaAdmin, ac.EvalPermission(ac.ActionLDAPStatusRead)), routing.Wrap(s.GetLDAPStatus))
	}, middleware.ReqSignedIn)

	if cfg.LDAPEnabled {
		bundleRegistry.RegisterSupportItemCollector(supportbundles.Collector{
			UID:               "auth-ldap",
			DisplayName:       "LDAP",
			Description:       "LDAP authentication healthcheck and configuration data",
			IncludedByDefault: false,
			Default:           false,
			Fn:                s.supportBundleCollector,
		})
	}

	return s
}

// swagger:route POST /admin/ldap/reload admin_ldap reloadLDAPCfg
//
// Reloads the LDAP configuration.
//
// If you are running Grafana Enterprise and have Fine-grained access control enabled, you need to have a permission with action `ldap.config:reload`.
//
// Security:
// - basic:
//
// Responses:
// 200: okResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (s *Service) ReloadLDAPCfg(c *contextmodel.ReqContext) response.Response {
	if !s.cfg.LDAPEnabled {
		return response.Error(http.StatusBadRequest, "LDAP is not enabled", nil)
	}

	if err := s.ldapService.ReloadConfig(); err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to reload LDAP config", err)
	}

	return response.Success("LDAP config reloaded")
}

// swagger:route GET /admin/ldap/status admin_ldap getLDAPStatus
//
// Attempts to connect to all the configured LDAP servers and returns information on whenever they're available or not.
//
// If you are running Grafana Enterprise and have Fine-grained access control enabled, you need to have a permission with action `ldap.status:read`.
//
// Security:
// - basic:
//
// Responses:
// 200: okResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (s *Service) GetLDAPStatus(c *contextmodel.ReqContext) response.Response {
	if !s.cfg.LDAPEnabled {
		return response.Error(http.StatusBadRequest, "LDAP is not enabled", nil)
	}

	ldapClient := s.ldapService.Client()
	if ldapClient == nil {
		return response.Error(http.StatusInternalServerError, "Failed to find the LDAP server", nil)
	}

	statuses, err := ldapClient.Ping()
	if err != nil {
		return response.Error(http.StatusBadRequest, "Failed to connect to the LDAP server(s)", err)
	}

	serverDTOs := []*LDAPServerDTO{}
	for _, status := range statuses {
		s := &LDAPServerDTO{
			Host:      status.Host,
			Available: status.Available,
			Port:      status.Port,
		}

		if status.Error != nil {
			s.Error = status.Error.Error()
		}

		serverDTOs = append(serverDTOs, s)
	}

	return response.JSON(http.StatusOK, serverDTOs)
}

// swagger:route POST /admin/ldap/sync/{user_id} admin_ldap postSyncUserWithLDAP
//
// Enables a single Grafana user to be synchronized against LDAP.
//
// If you are running Grafana Enterprise and have Fine-grained access control enabled, you need to have a permission with action `ldap.user:sync`.
//
// Security:
// - basic:
//
// Responses:
// 200: okResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (s *Service) PostSyncUserWithLDAP(c *contextmodel.ReqContext) response.Response {
	if !s.cfg.LDAPEnabled {
		return response.Error(http.StatusBadRequest, "LDAP is not enabled", nil)
	}

	ldapClient := s.ldapService.Client()
	if ldapClient == nil {
		return response.Error(http.StatusInternalServerError, "Failed to find the LDAP server", nil)
	}

	userId, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}

	query := user.GetUserByIDQuery{ID: userId}

	usr, err := s.userService.GetByID(c.Req.Context(), &query)
	if err != nil { // validate the userId exists
		if errors.Is(err, user.ErrUserNotFound) {
			return response.Error(http.StatusNotFound, user.ErrUserNotFound.Error(), nil)
		}

		return response.Error(http.StatusInternalServerError, "Failed to get user", err)
	}

	authModuleQuery := &login.GetAuthInfoQuery{UserId: usr.ID, AuthModule: login.LDAPAuthModule}
	if err := s.authInfoService.GetAuthInfo(c.Req.Context(), authModuleQuery); err != nil { // validate the userId comes from LDAP
		if errors.Is(err, user.ErrUserNotFound) {
			return response.Error(404, user.ErrUserNotFound.Error(), nil)
		}

		return response.Error(500, "Failed to get user", err)
	}

	userInfo, _, err := ldapClient.User(usr.Login)
	if err != nil {
		if errors.Is(err, multildap.ErrDidNotFindUser) { // User was not in the LDAP server - we need to take action:
			if s.cfg.AdminUser == usr.Login { // User is *the* Grafana Admin. We cannot disable it.
				errMsg := fmt.Sprintf(`Refusing to sync grafana super admin "%s" - it would be disabled`, usr.Login)
				s.log.Error(errMsg)
				return response.Error(http.StatusBadRequest, errMsg, err)
			}

			// Since the user was not in the LDAP server. Let's disable it.
			err := s.loginService.DisableExternalUser(c.Req.Context(), usr.Login)
			if err != nil {
				return response.Error(http.StatusInternalServerError, "Failed to disable the user", err)
			}

			err = s.sessionService.RevokeAllUserTokens(c.Req.Context(), userId)
			if err != nil {
				return response.Error(http.StatusInternalServerError, "Failed to remove session tokens for the user", err)
			}

			return response.Error(http.StatusBadRequest, "User not found in LDAP. Disabled the user without updating information", nil) // should this be a success?
		}

		s.log.Debug("Failed to sync the user with LDAP", "err", err)
		return response.Error(http.StatusBadRequest, "Something went wrong while finding the user in LDAP", err)
	}

	upsertCmd := &login.UpsertUserCommand{
		ReqContext:    c,
		ExternalUser:  userInfo,
		SignupAllowed: s.cfg.LDAPAllowSignup,
		UserLookupParams: login.UserLookupParams{
			UserID: &usr.ID, // Upsert by ID only
			Email:  nil,
			Login:  nil,
		},
	}

	err = s.loginService.UpsertUser(c.Req.Context(), upsertCmd)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to update the user", err)
	}

	return response.Success("User synced successfully")
}

// swagger:route GET /admin/ldap/{user_name} admin_ldap getUserFromLDAP
//
// Finds an user based on a username in LDAP. This helps illustrate how would the particular user be mapped in Grafana when synced.
//
// If you are running Grafana Enterprise and have Fine-grained access control enabled, you need to have a permission with action `ldap.user:read`.
//
// Security:
// - basic:
//
// Responses:
// 200: okResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (s *Service) GetUserFromLDAP(c *contextmodel.ReqContext) response.Response {
	if !s.cfg.LDAPEnabled {
		return response.Error(http.StatusBadRequest, "LDAP is not enabled", nil)
	}

	ldapClient := s.ldapService.Client()

	username := web.Params(c.Req)[":username"]
	if len(username) == 0 {
		return response.Error(http.StatusBadRequest, "Validation error. You must specify an username", nil)
	}

	user, serverConfig, err := ldapClient.User(username)
	if user == nil || err != nil {
		return response.Error(http.StatusNotFound, "No user was found in the LDAP server(s) with that username", err)
	}

	s.log.Debug("user found", "user", user)

	name, surname := splitName(user.Name)

	u := &LDAPUserDTO{
		Name:           &LDAPAttribute{serverConfig.Attr.Name, name},
		Surname:        &LDAPAttribute{serverConfig.Attr.Surname, surname},
		Email:          &LDAPAttribute{serverConfig.Attr.Email, user.Email},
		Username:       &LDAPAttribute{serverConfig.Attr.Username, user.Login},
		IsGrafanaAdmin: user.IsGrafanaAdmin,
		IsDisabled:     user.IsDisabled,
	}

	unmappedUserGroups := map[string]struct{}{}
	for _, userGroup := range user.Groups {
		unmappedUserGroups[strings.ToLower(userGroup)] = struct{}{}
	}

	orgIDs := []int64{} // IDs of the orgs the user is a member of
	orgRolesMap := map[int64]org.RoleType{}
	for _, group := range serverConfig.Groups {
		// only use the first match for each org
		if orgRolesMap[group.OrgId] != "" {
			continue
		}

		if ldap.IsMemberOf(user.Groups, group.GroupDN) {
			orgRolesMap[group.OrgId] = group.OrgRole
			u.OrgRoles = append(u.OrgRoles, LDAPRoleDTO{GroupDN: group.GroupDN,
				OrgId: group.OrgId, OrgRole: group.OrgRole})
			delete(unmappedUserGroups, strings.ToLower(group.GroupDN))
			orgIDs = append(orgIDs, group.OrgId)
		}
	}

	for userGroup := range unmappedUserGroups {
		u.OrgRoles = append(u.OrgRoles, LDAPRoleDTO{GroupDN: userGroup})
	}

	s.log.Debug("mapping org roles", "orgsRoles", u.OrgRoles)
	if err := u.fetchOrgs(c.Req.Context(), s.orgService); err != nil {
		return response.Error(http.StatusBadRequest, "An organization was not found - Please verify your LDAP configuration", err)
	}

	u.Teams, err = s.ldapGroupsService.GetTeams(user.Groups, orgIDs)
	if err != nil {
		return response.Error(http.StatusBadRequest, "Unable to find the teams for this user", err)
	}

	return response.JSON(http.StatusOK, u)
}

// splitName receives the full name of a user and splits it into two parts: A name and a surname.
func splitName(name string) (string, string) {
	names := util.SplitString(name)

	switch len(names) {
	case 0:
		return "", ""
	case 1:
		return names[0], ""
	default:
		return names[0], names[1]
	}
}

// fetchOrgs fetches the organization(s) information by executing a single query to the database. Then, populating the DTO with the information retrieved.
func (user *LDAPUserDTO) fetchOrgs(ctx context.Context, orga org.Service) error {
	orgIds := []int64{}

	for _, or := range user.OrgRoles {
		orgIds = append(orgIds, or.OrgId)
	}

	q := &org.SearchOrgsQuery{}
	q.IDs = orgIds

	result, err := orga.Search(ctx, q)
	if err != nil {
		return err
	}

	orgNamesById := map[int64]string{}
	for _, org := range result {
		orgNamesById[org.ID] = org.Name
	}

	for i, orgDTO := range user.OrgRoles {
		if orgDTO.OrgId < 1 {
			continue
		}

		orgName := orgNamesById[orgDTO.OrgId]

		if orgName != "" {
			user.OrgRoles[i].OrgName = orgName
		} else {
			return &OrganizationNotFoundError{orgDTO.OrgId}
		}
	}

	return nil
}
