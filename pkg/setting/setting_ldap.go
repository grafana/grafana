package setting

type LdapGroupToOrgRole struct {
	LdapGroupPath string
	OrgId         int
	OrgRole       string
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

	LdapGroups []LdapGroupToOrgRole
}
