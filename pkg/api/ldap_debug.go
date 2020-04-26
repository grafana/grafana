package api

import (
	"fmt"
	"net/http"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/login"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/ldap"
	"github.com/grafana/grafana/pkg/services/multildap"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

var (
	getLDAPConfig = multildap.GetConfig
	newLDAP       = multildap.New

	logger = log.New("LDAP.debug")

	errOrganizationNotFound = func(orgId int64) error {
		return fmt.Errorf("Unable to find organization with ID '%d'", orgId)
	}
)

// LDAPAttribute is a serializer for user attributes mapped from LDAP. Is meant to display both the serialized value and the LDAP key we received it from.
type LDAPAttribute struct {
	ConfigAttributeValue string `json:"cfgAttrValue"`
	LDAPAttributeValue   string `json:"ldapValue"`
}

// RoleDTO is a serializer for mapped roles from LDAP
type LDAPRoleDTO struct {
	OrgId   int64           `json:"orgId"`
	OrgName string          `json:"orgName"`
	OrgRole models.RoleType `json:"orgRole"`
	GroupDN string          `json:"groupDN"`
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
func (user *LDAPUserDTO) FetchOrgs() error {
	orgIds := []int64{}

	for _, or := range user.OrgRoles {
		orgIds = append(orgIds, or.OrgId)
	}

	q := &models.SearchOrgsQuery{}
	q.Ids = orgIds

	if err := bus.Dispatch(q); err != nil {
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

// ReloadLDAPCfg reloads the LDAP configuration
func (server *HTTPServer) ReloadLDAPCfg() Response {
	if !ldap.IsEnabled() {
		return Error(http.StatusBadRequest, "LDAP is not enabled", nil)
	}

	err := ldap.ReloadConfig()
	if err != nil {
		return Error(http.StatusInternalServerError, "Failed to reload LDAP config", err)
	}
	return Success("LDAP config reloaded")
}

// GetLDAPStatus attempts to connect to all the configured LDAP servers and returns information on whenever they're available or not.
func (server *HTTPServer) GetLDAPStatus(c *models.ReqContext) Response {
	if !ldap.IsEnabled() {
		return Error(http.StatusBadRequest, "LDAP is not enabled", nil)
	}

	ldapConfig, err := getLDAPConfig()

	if err != nil {
		return Error(http.StatusBadRequest, "Failed to obtain the LDAP configuration. Please verify the configuration and try again", err)
	}

	ldap := newLDAP(ldapConfig.Servers)

	if ldap == nil {
		return Error(http.StatusInternalServerError, "Failed to find the LDAP server", nil)
	}

	statuses, err := ldap.Ping()

	if err != nil {
		return Error(http.StatusBadRequest, "Failed to connect to the LDAP server(s)", err)
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

	return JSON(http.StatusOK, serverDTOs)
}

// PostSyncUserWithLDAP enables a single Grafana user to be synchronized against LDAP
func (server *HTTPServer) PostSyncUserWithLDAP(c *models.ReqContext) Response {
	if !ldap.IsEnabled() {
		return Error(http.StatusBadRequest, "LDAP is not enabled", nil)
	}

	ldapConfig, err := getLDAPConfig()

	if err != nil {
		return Error(http.StatusBadRequest, "Failed to obtain the LDAP configuration. Please verify the configuration and try again", err)
	}

	userId := c.ParamsInt64(":id")

	query := models.GetUserByIdQuery{Id: userId}

	if err := bus.Dispatch(&query); err != nil { // validate the userId exists
		if err == models.ErrUserNotFound {
			return Error(404, models.ErrUserNotFound.Error(), nil)
		}

		return Error(500, "Failed to get user", err)
	}

	authModuleQuery := &models.GetAuthInfoQuery{UserId: query.Result.Id, AuthModule: models.AuthModuleLDAP}

	if err := bus.Dispatch(authModuleQuery); err != nil { // validate the userId comes from LDAP
		if err == models.ErrUserNotFound {
			return Error(404, models.ErrUserNotFound.Error(), nil)
		}

		return Error(500, "Failed to get user", err)
	}

	ldapServer := newLDAP(ldapConfig.Servers)
	user, _, err := ldapServer.User(query.Result.Login)

	if err != nil {
		if err == multildap.ErrDidNotFindUser { // User was not in the LDAP server - we need to take action:
			if setting.AdminUser == query.Result.Login { // User is *the* Grafana Admin. We cannot disable it.
				errMsg := fmt.Sprintf(`Refusing to sync grafana super admin "%s" - it would be disabled`, query.Result.Login)
				logger.Error(errMsg)
				return Error(http.StatusBadRequest, errMsg, err)
			}

			// Since the user was not in the LDAP server. Let's disable it.
			err := login.DisableExternalUser(query.Result.Login)

			if err != nil {
				return Error(http.StatusInternalServerError, "Failed to disable the user", err)
			}

			err = server.AuthTokenService.RevokeAllUserTokens(c.Req.Context(), userId)
			if err != nil {
				return Error(http.StatusInternalServerError, "Failed to remove session tokens for the user", err)
			}

			return Error(http.StatusBadRequest, "User not found in LDAP. Disabled the user without updating information", nil) // should this be a success?
		}

		logger.Debug("Failed to sync the user with LDAP", "err", err)
		return Error(http.StatusBadRequest, "Something went wrong while finding the user in LDAP", err)
	}

	upsertCmd := &models.UpsertUserCommand{
		ReqContext:    c,
		ExternalUser:  user,
		SignupAllowed: setting.LDAPAllowSignup,
	}

	err = bus.Dispatch(upsertCmd)

	if err != nil {
		return Error(http.StatusInternalServerError, "Failed to update the user", err)
	}

	return Success("User synced successfully")
}

// GetUserFromLDAP finds an user based on a username in LDAP. This helps illustrate how would the particular user be mapped in Grafana when synced.
func (server *HTTPServer) GetUserFromLDAP(c *models.ReqContext) Response {
	if !ldap.IsEnabled() {
		return Error(http.StatusBadRequest, "LDAP is not enabled", nil)
	}

	ldapConfig, err := getLDAPConfig()

	if err != nil {
		return Error(http.StatusBadRequest, "Failed to obtain the LDAP configuration", err)
	}

	ldap := newLDAP(ldapConfig.Servers)

	username := c.Params(":username")

	if len(username) == 0 {
		return Error(http.StatusBadRequest, "Validation error. You must specify an username", nil)
	}

	user, serverConfig, err := ldap.User(username)

	if user == nil {
		return Error(http.StatusNotFound, "No user was found in the LDAP server(s) with that username", err)
	}

	logger.Debug("user found", "user", user)

	name, surname := splitName(user.Name)

	u := &LDAPUserDTO{
		Name:           &LDAPAttribute{serverConfig.Attr.Name, name},
		Surname:        &LDAPAttribute{serverConfig.Attr.Surname, surname},
		Email:          &LDAPAttribute{serverConfig.Attr.Email, user.Email},
		Username:       &LDAPAttribute{serverConfig.Attr.Username, user.Login},
		IsGrafanaAdmin: user.IsGrafanaAdmin,
		IsDisabled:     user.IsDisabled,
	}

	orgRoles := []LDAPRoleDTO{}

	// Need to iterate based on the config groups as only the first match for an org is used
	// We are showing all matches as that should help in understanding why one match wins out
	// over another.
	for _, configGroup := range serverConfig.Groups {
		for _, userGroup := range user.Groups {
			if configGroup.GroupDN == userGroup {
				r := &LDAPRoleDTO{GroupDN: configGroup.GroupDN, OrgId: configGroup.OrgId, OrgRole: configGroup.OrgRole}
				orgRoles = append(orgRoles, *r)
				break
			}
		}
		//}
	}

	// Then, we find what we did not match by inspecting the list of groups returned from
	// LDAP against what we have already matched above.
	for _, userGroup := range user.Groups {
		var matched bool

		for _, orgRole := range orgRoles {
			if orgRole.GroupDN == userGroup { // we already matched it
				matched = true
				break
			}
		}

		if !matched {
			r := &LDAPRoleDTO{GroupDN: userGroup}
			orgRoles = append(orgRoles, *r)
		}
	}

	u.OrgRoles = orgRoles

	logger.Debug("mapping org roles", "orgsRoles", u.OrgRoles)
	err = u.FetchOrgs()

	if err != nil {
		return Error(http.StatusBadRequest, "An oganization was not found - Please verify your LDAP configuration", err)
	}

	cmd := &models.GetTeamsForLDAPGroupCommand{Groups: user.Groups}
	err = bus.Dispatch(cmd)

	if err != bus.ErrHandlerNotFound && err != nil {
		return Error(http.StatusBadRequest, "Unable to find the teams for this user", err)
	}

	u.Teams = cmd.Result

	return JSON(200, u)
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
