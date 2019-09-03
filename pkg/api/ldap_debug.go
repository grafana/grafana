package api

import (
	"fmt"
	"net/http"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/ldap"
	"github.com/grafana/grafana/pkg/services/multildap"
	"github.com/grafana/grafana/pkg/util"
)

var (
	getLDAPConfig = multildap.GetConfig
	newLDAP       = multildap.New

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
type RoleDTO struct {
	OrgId   int64           `json:"orgId"`
	OrgName string          `json:"orgName"`
	OrgRole models.RoleType `json:"orgRole"`
	GroupDN string          `json:"groupDN"`
}

// TeamDTO is a serializer for mapped Teams from LDAP
type TeamDTO struct {
	GroupDN  string `json:"groupDN"`
	TeamId   int64  `json:"teamId"`
	TeamName string `json:"teamName"`
}

// LDAPUserDTO is a serializer for users mapped from LDAP
type LDAPUserDTO struct {
	Name           *LDAPAttribute `json:"name"`
	Surname        *LDAPAttribute `json:"surname"`
	Email          *LDAPAttribute `json:"email"`
	Username       *LDAPAttribute `json:"login"`
	IsGrafanaAdmin *bool          `json:"isGrafanaAdmin"`
	IsDisabled     bool           `json:"isDisabled"`
	OrgRoles       []RoleDTO      `json:"roles"`
	Teams          []TeamDTO      `json:"teams"`
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
		return Error(400, "LDAP is not enabled", nil)
	}

	err := ldap.ReloadConfig()
	if err != nil {
		return Error(500, "Failed to reload ldap config.", err)
	}
	return Success("LDAP config reloaded")
}

// GetUserFromLDAP finds an user based on a username in LDAP. This helps illustrate how would the particular user be mapped in Grafana when synced.
func (server *HTTPServer) GetUserFromLDAP(c *models.ReqContext) Response {
	ldapConfig, err := getLDAPConfig()

	if err != nil {
		return Error(400, "Failed to obtain the LDAP configuration. Please ", err)
	}

	ldap := newLDAP(ldapConfig.Servers)

	username := c.Params(":username")

	if len(username) == 0 {
		return Error(http.StatusBadRequest, "Validation error. You must specify an username", nil)
	}

	user, serverConfig, err := ldap.User(username)

	if user == nil {
		return Error(http.StatusNotFound, "No user was found on the LDAP server(s)", err)
	}

	name, surname := splitName(user.Name)

	u := &LDAPUserDTO{
		Name:           &LDAPAttribute{serverConfig.Attr.Name, name},
		Surname:        &LDAPAttribute{serverConfig.Attr.Surname, surname},
		Email:          &LDAPAttribute{serverConfig.Attr.Email, user.Email},
		Username:       &LDAPAttribute{serverConfig.Attr.Username, user.Login},
		IsGrafanaAdmin: user.IsGrafanaAdmin,
		IsDisabled:     user.IsDisabled,
	}

	orgRoles := []RoleDTO{}

	for _, g := range serverConfig.Groups {
		role := &RoleDTO{}

		if isMatchToLDAPGroup(user, g) {
			role.OrgId = g.OrgID
			role.OrgRole = user.OrgRoles[g.OrgID]
			role.GroupDN = g.GroupDN

			orgRoles = append(orgRoles, *role)
		} else {
			role.OrgId = g.OrgID
			role.GroupDN = g.GroupDN

			orgRoles = append(orgRoles, *role)
		}
	}

	u.OrgRoles = orgRoles

	err = u.FetchOrgs()

	if err != nil {
		return Error(http.StatusBadRequest, "Organization not found - Please verify your LDAP configuration", err)
	}

	return JSON(200, u)
}

// isMatchToLDAPGroup determines if we were able to match an LDAP group to an organization+role.
// Since we allow one role per organization. If it's set, we were able to match it.
func isMatchToLDAPGroup(user *models.ExternalUserInfo, groupConfig *ldap.GroupToOrgRole) bool {
	return user.OrgRoles[groupConfig.OrgID] == groupConfig.OrgRole
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
