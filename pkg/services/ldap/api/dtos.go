package api

import (
	"github.com/grafana/grafana/pkg/services/ldap"
	"github.com/grafana/grafana/pkg/services/org"
)

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
	Name           *LDAPAttribute         `json:"name"`
	Surname        *LDAPAttribute         `json:"surname"`
	Email          *LDAPAttribute         `json:"email"`
	Username       *LDAPAttribute         `json:"login"`
	IsGrafanaAdmin *bool                  `json:"isGrafanaAdmin"`
	IsDisabled     bool                   `json:"isDisabled"`
	OrgRoles       []LDAPRoleDTO          `json:"roles"`
	Teams          []ldap.TeamOrgGroupDTO `json:"teams"`
}

// LDAPServerDTO is a serializer for LDAP server statuses
type LDAPServerDTO struct {
	Host      string `json:"host"`
	Port      int    `json:"port"`
	Available bool   `json:"available"`
	Error     string `json:"error"`
}
