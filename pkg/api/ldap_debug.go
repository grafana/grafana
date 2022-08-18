package api

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/ldap"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/multildap"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

var (
	getLDAPConfig = multildap.GetConfig
	newLDAP       = multildap.New

	ldapLogger = log.New("LDAP.debug")

	errOrganizationNotFound = func(orgId int64) error {
		return fmt.Errorf("unable to find organization with ID '%d'", orgId)
	}
)

// LDAPAttribute is a serializer for user attributes mapped from LDAP. Is meant to display both the serialized value and the LDAP key we received it from.
type LDAPAttribute struct {
	ConfigAttributeValue string `json:"cfgAttrValue"`
	LDAPAttributeValue   string `json:"ldapValue"`
}

// RoleDTO is a serializer for mapped roles from LDAP
type LDAPRoleDTO struct {
	OrgId   int64        `json:"orgId"`
	OrgName string       `json:"orgName"`
	OrgRole org.RoleType `json:"orgRole"`
	GroupDN string       `json:"groupDN"`
}

// LDAPUserDTO is a serializer for users mapped from LDAP
type LDAPUserDTO struct {
	Name           *LDAPAttribute           `json:"name"`
	Surname        *LDAPAttribute           `json:"surname"`
	Email          *LDAPAttribute           `json:"email"`
	Username       *LDAPAttribute           `json:"login"`
	IsGrafanaAdmin *bool                    `json:"isGrafanaAdmin"`
	IsDisabled     bool                     `json:"isDisabled"`
	OrgRoles       []LDAPRoleDTO            `json:"roles"`
	Teams          []models.TeamOrgGroupDTO `json:"teams"`
}

// LDAPServerDTO is a serializer for LDAP server statuses
type LDAPServerDTO struct {
	Host      string `json:"host"`
	Port      int    `json:"port"`
	Available bool   `json:"available"`
	Error     string `json:"error"`
}

// FetchOrgs fetches the organization(s) information by executing a single query to the database. Then, populating the DTO with the information retrieved.
func (user *LDAPUserDTO) FetchOrgs(ctx context.Context, sqlstore sqlstore.Store) error {
	orgIds := []int64{}

	for _, or := range user.OrgRoles {
		orgIds = append(orgIds, or.OrgId)
	}

	q := &models.SearchOrgsQuery{}
	q.Ids = orgIds

	if err := sqlstore.SearchOrgs(ctx, q); err != nil {
		return err
	}

	orgNamesById := map[int64]string{}
	for _, org := range q.Result {
		orgNamesById[org.Id] = org.Name
	}

	for i, orgDTO := range user.OrgRoles {
		if orgDTO.OrgId < 1 {
			continue
		}

		orgName := orgNamesById[orgDTO.OrgId]

		if orgName != "" {
			user.OrgRoles[i].OrgName = orgName
		} else {
			return errOrganizationNotFound(orgDTO.OrgId)
		}
	}

	return nil
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
func (hs *HTTPServer) ReloadLDAPCfg(c *models.ReqContext) response.Response {
	if !ldap.IsEnabled() {
		return response.Error(http.StatusBadRequest, "LDAP is not enabled", nil)
	}

	err := ldap.ReloadConfig()
	if err != nil {
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
func (hs *HTTPServer) GetLDAPStatus(c *models.ReqContext) response.Response {
	if !ldap.IsEnabled() {
		return response.Error(http.StatusBadRequest, "LDAP is not enabled", nil)
	}

	ldapConfig, err := getLDAPConfig(hs.Cfg)
	if err != nil {
		return response.Error(http.StatusBadRequest, "Failed to obtain the LDAP configuration. Please verify the configuration and try again", err)
	}

	ldap := newLDAP(ldapConfig.Servers)

	if ldap == nil {
		return response.Error(http.StatusInternalServerError, "Failed to find the LDAP server", nil)
	}

	statuses, err := ldap.Ping()
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
func (hs *HTTPServer) PostSyncUserWithLDAP(c *models.ReqContext) response.Response {
	if !ldap.IsEnabled() {
		return response.Error(http.StatusBadRequest, "LDAP is not enabled", nil)
	}

	ldapConfig, err := getLDAPConfig(hs.Cfg)
	if err != nil {
		return response.Error(http.StatusBadRequest, "Failed to obtain the LDAP configuration. Please verify the configuration and try again", err)
	}

	userId, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}

	query := user.GetUserByIDQuery{ID: userId}

	usr, err := hs.userService.GetByID(c.Req.Context(), &query)
	if err != nil { // validate the userId exists
		if errors.Is(err, user.ErrUserNotFound) {
			return response.Error(404, user.ErrUserNotFound.Error(), nil)
		}

		return response.Error(500, "Failed to get user", err)
	}

	authModuleQuery := &models.GetAuthInfoQuery{UserId: usr.ID, AuthModule: login.LDAPAuthModule}
	if err := hs.authInfoService.GetAuthInfo(c.Req.Context(), authModuleQuery); err != nil { // validate the userId comes from LDAP
		if errors.Is(err, user.ErrUserNotFound) {
			return response.Error(404, user.ErrUserNotFound.Error(), nil)
		}

		return response.Error(500, "Failed to get user", err)
	}

	ldapServer := newLDAP(ldapConfig.Servers)
	userInfo, _, err := ldapServer.User(usr.Login)
	if err != nil {
		if errors.Is(err, multildap.ErrDidNotFindUser) { // User was not in the LDAP server - we need to take action:
			if hs.Cfg.AdminUser == usr.Login { // User is *the* Grafana Admin. We cannot disable it.
				errMsg := fmt.Sprintf(`Refusing to sync grafana super admin "%s" - it would be disabled`, usr.Login)
				ldapLogger.Error(errMsg)
				return response.Error(http.StatusBadRequest, errMsg, err)
			}

			// Since the user was not in the LDAP server. Let's disable it.
			err := hs.Login.DisableExternalUser(c.Req.Context(), usr.Login)
			if err != nil {
				return response.Error(http.StatusInternalServerError, "Failed to disable the user", err)
			}

			err = hs.AuthTokenService.RevokeAllUserTokens(c.Req.Context(), userId)
			if err != nil {
				return response.Error(http.StatusInternalServerError, "Failed to remove session tokens for the user", err)
			}

			return response.Error(http.StatusBadRequest, "User not found in LDAP. Disabled the user without updating information", nil) // should this be a success?
		}

		ldapLogger.Debug("Failed to sync the user with LDAP", "err", err)
		return response.Error(http.StatusBadRequest, "Something went wrong while finding the user in LDAP", err)
	}

	upsertCmd := &models.UpsertUserCommand{
		ReqContext:    c,
		ExternalUser:  userInfo,
		SignupAllowed: hs.Cfg.LDAPAllowSignup,
		UserLookupParams: models.UserLookupParams{
			UserID: &usr.ID, // Upsert by ID only
			Email:  nil,
			Login:  nil,
		},
	}

	err = hs.Login.UpsertUser(c.Req.Context(), upsertCmd)
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
func (hs *HTTPServer) GetUserFromLDAP(c *models.ReqContext) response.Response {
	if !ldap.IsEnabled() {
		return response.Error(http.StatusBadRequest, "LDAP is not enabled", nil)
	}

	ldapConfig, err := getLDAPConfig(hs.Cfg)
	if err != nil {
		return response.Error(http.StatusBadRequest, "Failed to obtain the LDAP configuration", err)
	}

	multiLDAP := newLDAP(ldapConfig.Servers)

	username := web.Params(c.Req)[":username"]

	if len(username) == 0 {
		return response.Error(http.StatusBadRequest, "Validation error. You must specify an username", nil)
	}

	user, serverConfig, err := multiLDAP.User(username)
	if user == nil || err != nil {
		return response.Error(http.StatusNotFound, "No user was found in the LDAP server(s) with that username", err)
	}

	ldapLogger.Debug("user found", "user", user)

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

	ldapLogger.Debug("mapping org roles", "orgsRoles", u.OrgRoles)
	if err := u.FetchOrgs(c.Req.Context(), hs.SQLStore); err != nil {
		return response.Error(http.StatusBadRequest, "An organization was not found - Please verify your LDAP configuration", err)
	}

	u.Teams, err = hs.ldapGroups.GetTeams(user.Groups, orgIDs)
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

// swagger:parameters getUserFromLDAP
type GetLDAPUserParams struct {
	// in:path
	// required:true
	UserName string `json:"user_name"`
}

// swagger:parameters postSyncUserWithLDAP
type SyncLDAPUserParams struct {
	// in:path
	// required:true
	UserID int64 `json:"user_id"`
}
