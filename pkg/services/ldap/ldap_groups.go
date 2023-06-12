package ldap

type Groups interface {
	GetTeams(groups []string, orgIDs []int64) ([]TeamOrgGroupDTO, error)
}

type OSSGroups struct{}

func ProvideGroupsService() *OSSGroups {
	return &OSSGroups{}
}

func (*OSSGroups) GetTeams(_ []string, _ []int64) ([]TeamOrgGroupDTO, error) {
	return nil, nil
}
