package auth

import (
	"context"
	"net/http"

	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/services/datasources"
)

const datasourceKey = "grafanaId"

type IDService interface {
	// SignIdentity will create a new id token for provided identity
	SignIdentity(ctx context.Context, id identity.Requester, req *http.Request) (string, error)
}

func IsIDSignerEnabledForDatasource(ds *datasources.DataSource) bool {
	return ds.JsonData != nil && ds.JsonData.Get(datasourceKey).MustBool()
}

type IDAssertions struct {
	Teams     []string `json:"groups"`
	IPAddress string   `json:"ip"`
}
