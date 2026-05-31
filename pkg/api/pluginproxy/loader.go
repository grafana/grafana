package pluginproxy

import (
	"context"
	"net/http"

	authlib "github.com/grafana/authlib/types"
	datasourcesV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/registry/apis/datasource/converter"
	"github.com/grafana/grafana/pkg/services/datasources"
)

// DataSourceLoader allows async access to the datasource and helps detach
// the new apiserver proxy routes from the full legacy DataSourceService
type DataSourceLoader interface {
	PluginType() string
	DataSource(ctx context.Context) (*datasourcesV0.DataSource, error)
	GetHTTPTransport(ctx context.Context, clientProvider httpclient.Provider) (http.RoundTripper, error)
	DecryptedPassword(ctx context.Context) (string, error)
	DecryptedBasicAuthPassword(ctx context.Context) (string, error)
	DecryptedValues(ctx context.Context) (map[string]string, error)
}

// NewDataSourceLoader creates a new DataSourceLoader using the legacy datasource and service
func NewDataSourceLoader(ds *datasources.DataSource, service datasources.DataSourceService) (DataSourceLoader, error) {
	return &loaderFromService{
		ds:      ds,
		service: service,
	}, nil
}

var _ DataSourceLoader = (*loaderFromService)(nil)

type loaderFromService struct {
	ds      *datasources.DataSource
	service datasources.DataSourceService
}

// PluginType implements [DataSourceLoader].
func (l *loaderFromService) PluginType() string {
	return l.ds.Type
}

func (l *loaderFromService) DataSource(ctx context.Context) (*datasourcesV0.DataSource, error) {
	ds := l.ds
	c := converter.NewConverter(authlib.OrgNamespaceFormatter, ds.Type+".datasource.grafana.app", ds.Type, nil)
	return c.AsDataSource(ds)
}

// DecryptedBasicAuthPassword implements [DataSourceLoader].
func (l *loaderFromService) DecryptedBasicAuthPassword(ctx context.Context) (string, error) {
	return l.service.DecryptedBasicAuthPassword(ctx, l.ds)
}

// DecryptedPassword implements [DataSourceLoader].
func (l *loaderFromService) DecryptedPassword(ctx context.Context) (string, error) {
	return l.service.DecryptedPassword(ctx, l.ds)
}

// DecryptedValues implements [DataSourceLoader].
func (l *loaderFromService) DecryptedValues(ctx context.Context) (map[string]string, error) {
	return l.service.DecryptedValues(ctx, l.ds)
}

// GetHTTPTransport implements [DataSourceLoader].
func (l *loaderFromService) GetHTTPTransport(ctx context.Context, clientProvider httpclient.Provider) (http.RoundTripper, error) {
	return l.service.GetHTTPTransport(ctx, l.ds, clientProvider)
}
