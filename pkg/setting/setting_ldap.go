package setting

type LdapMemberToOrgRole struct {
	LdapMemberPattern string
	OrgId             int
	OrgRole           string
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
	AttrMail     string
	AttrMemberOf string

	SearchFilter  []string
	SearchBaseDNs []string

	LdapMemberMap []LdapMemberToOrgRole
}
