package auth

type LdapGroupToOrgRole struct {
	GroupDN string
	OrgId   int
	OrgName string
	OrgRole string
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
