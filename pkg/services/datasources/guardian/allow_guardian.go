package guardian

import (
	"github.com/grafana/grafana/pkg/services/datasources"
)

var _ DatasourceGuardian = new(AllowGuardian)

// AllowGuardian is used whenever an enterprise build is running without a license.
// It allows every one to Query all data sources and will not filter out any of them
type AllowGuardian struct{}

func (n AllowGuardian) CanQuery(datasourceID int64) (bool, error) {
	return true, nil
}

func (n AllowGuardian) FilterDatasourcesByQueryPermissions(ds []*datasources.DataSource) ([]*datasources.DataSource, error) {
	return ds, nil
}
