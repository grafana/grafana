package ldap

import "github.com/grafana/grafana/pkg/models"

type Groups interface {
	GetTeams(groups []string, orgIDs []int64) ([]models.TeamOrgGroupDTO, error)
}

type OSSGroups struct{}

func ProvideGroupsService() *OSSGroups {
	return &OSSGroups{}
}

func (*OSSGroups) GetTeams(_ []string, _ []int64) ([]models.TeamOrgGroupDTO, error) {
	return nil, nil
}
