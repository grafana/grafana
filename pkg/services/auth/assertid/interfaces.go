package assertid

import (
	"context"
	"net/http"

	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/services/datasources"
)

const datasourceKey = "grafanaId"

type Service interface {
	ActiveUserAssertion(ctx context.Context, id identity.Requester, req *http.Request) (string, error)
}

func IsIDSignerEnabledForDatasource(ds *datasources.DataSource) bool {
	return ds.JsonData != nil && ds.JsonData.Get(datasourceKey).MustBool()
}
