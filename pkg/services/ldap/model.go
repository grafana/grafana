package ldap

type TeamOrgGroupDTO struct {
	TeamName string `json:"teamName"`
	OrgName  string `json:"orgName"`
	GroupDN  string `json:"groupDN"`
}
