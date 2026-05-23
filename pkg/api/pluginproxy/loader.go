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

// This is scoped to a single datasource -- not generic
type DataSourceLoader interface {
	DataSource(ctx context.Context) (*datasourcesV0.DataSource, error)
	GetHTTPTransport(ctx context.Context, clientProvider httpclient.Provider) (http.RoundTripper, error)
	DecryptedPassword(ctx context.Context) (string, error)
	DecryptedBasicAuthPassword(ctx context.Context) (string, error)
	DecryptedValues(ctx context.Context) (map[string]string, error)
}

func NewDataSourceLoader(ds *datasources.DataSource, service datasources.DataSourceService) (DataSourceLoader, error) {
	converter := converter.NewConverter(authlib.OrgNamespaceFormatter, ds.Type+".datasource.grafana.app", ds.Type, []string{})
	dsV0, err := converter.AsDataSource(ds)
	if err != nil {
		return nil, err
	}

	return &loaderFromService{
		ds:      ds,
		dsV0:    dsV0,
		service: service,
	}, nil
}

var _ DataSourceLoader = (*loaderFromService)(nil)

type loaderFromService struct {
	dsV0    *datasourcesV0.DataSource
	ds      *datasources.DataSource
	service datasources.DataSourceService
}

func (l *loaderFromService) DataSource(ctx context.Context) (*datasourcesV0.DataSource, error) {
	return l.dsV0, nil
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
