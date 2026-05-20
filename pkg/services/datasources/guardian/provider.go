package guardian

import (
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/team"
)

type DatasourceGuardianProvider interface {
	New(orgID int64, user identity.Requester, dataSources ...datasources.DataSource) DatasourceGuardian
}

type DatasourceGuardian interface {
	CanQuery(datasourceID int64) (bool, error)
	FilterDatasourcesByReadPermissions([]*datasources.DataSource) ([]*datasources.DataSource, error)
	FilterDatasourcesByQueryPermissions([]*datasources.DataSource) ([]*datasources.DataSource, error)
}

func ProvideGuardian(dsService datasources.DataSourceService, teamService team.Service) *OSSProvider {
	return &OSSProvider{dsService: dsService, teamService: teamService}
}

type OSSProvider struct {
	dsService   datasources.DataSourceService
	teamService TeamMembershipGetter
}

func (p *OSSProvider) New(orgID int64, user identity.Requester, dataSources ...datasources.DataSource) DatasourceGuardian {
	return NewTeamBasedGuardianWithMembershipGetter(user, orgID, p.dsService, p.teamService)
}