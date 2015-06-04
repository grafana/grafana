package setting

type LdapFilterToOrg struct {
	Filter  string
	OrgId   int
	OrgRole string
}

type LdapSettings struct {
	Enabled      bool
	Hosts        []string
	UseSSL       bool
	BindDN       string
	AttrUsername string
	AttrName     string
	AttrSurname  string
	AttrMail     string
	Filters      []LdapFilterToOrg
}
