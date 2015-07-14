package auth

import m "github.com/grafana/grafana/pkg/models"

type LdapGroupToOrgRole struct {
	GroupDN string
	OrgId   int64
	OrgRole m.RoleType
}

type LdapServerConf struct {
	Host         string
	Port         string
	UseSSL       bool
	BindDN       string
	BindPassword string
	AttrUsername string
	AttrName     string
	AttrSurname  string
	AttrEmail    string
	AttrMemberOf string

	SearchFilter  string
	SearchBaseDNs []string

	LdapGroups []*LdapGroupToOrgRole
}
