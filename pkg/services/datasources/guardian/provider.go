package guardian

import (
	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/services/datasources"
)

type DatasourceGuardianProvider interface {
	New(orgID int64, user identity.Requester, dataSources ...datasources.DataSource) DatasourceGuardian
}

type DatasourceGuardian interface {
	CanQuery(datasourceID int64) (bool, error)
	FilterDatasourcesByQueryPermissions([]*datasources.DataSource) ([]*datasources.DataSource, error)
}

func ProvideGuardian() *OSSProvider {
	return &OSSProvider{}
}

type OSSProvider struct{}

func (p *OSSProvider) New(orgID int64, user identity.Requester, dataSources ...datasources.DataSource) DatasourceGuardian {
	return &AllowGuardian{}
}
