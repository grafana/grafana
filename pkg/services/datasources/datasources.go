package datasources

import (
	"context"
	"net/http"

	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	queryV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/httpclient"
)

// DataSourceService interface for interacting with datasources.
type DataSourceService interface {
	queryV0.DataSourceConnectionProvider

	// GetDataSource gets a datasource.
	GetDataSource(ctx context.Context, query *GetDataSourceQuery) (*DataSource, error)

	// GetDataSourceInNamespace gets a datasource by namespace, name (datasource uid), and group (datasource type).
	GetDataSourceInNamespace(ctx context.Context, namespace, name, group string) (*DataSource, error)

	// GetDataSources gets datasources.
	GetDataSources(ctx context.Context, query *GetDataSourcesQuery) ([]*DataSource, error)

	// GetAllDataSources gets all datasources.
	GetAllDataSources(ctx context.Context, query *GetAllDataSourcesQuery) (res []*DataSource, err error)

	// GetPrunableProvisionedDataSources gets all provisioned data sources that can be pruned.
	GetPrunableProvisionedDataSources(ctx context.Context) (res []*DataSource, err error)

	// GetDataSourcesByType gets datasources by type.
	GetDataSourcesByType(ctx context.Context, query *GetDataSourcesByTypeQuery) ([]*DataSource, error)

	// AddDataSource adds a new datasource.
	AddDataSource(ctx context.Context, cmd *AddDataSourceCommand) (*DataSource, error)

	// DeleteDataSource deletes an existing datasource.
	DeleteDataSource(ctx context.Context, cmd *DeleteDataSourceCommand) error

	// UpdateDataSource updates an existing datasource.
	UpdateDataSource(ctx context.Context, cmd *UpdateDataSourceCommand) (*DataSource, error)

	// GetHTTPTransport gets a datasource specific HTTP transport.
	GetHTTPTransport(ctx context.Context, ds *DataSource, provider httpclient.Provider, customMiddlewares ...sdkhttpclient.Middleware) (http.RoundTripper, error)

	// DecryptedValues decrypts the encrypted secureJSONData of the provided datasource and
	// returns the decrypted values.
	DecryptedValues(ctx context.Context, ds *DataSource) (map[string]string, error)

	// DecryptedValue decrypts the encrypted datasource secureJSONData identified by key
	// and returns the decrypted value.
	DecryptedValue(ctx context.Context, ds *DataSource, key string) (string, bool, error)

	// DecryptedBasicAuthPassword decrypts the encrypted datasource basic authentication
	// password and returns the decrypted value.
	DecryptedBasicAuthPassword(ctx context.Context, ds *DataSource) (string, error)

	// DecryptedPassword decrypts the encrypted datasource password and returns the
	// decrypted value.
	DecryptedPassword(ctx context.Context, ds *DataSource) (string, error)

	// CustomHeaders returns a map of custom headers the user might have
	// configured for this Datasource. Not every datasource can has the option
	// to configure those.
	CustomHeaders(ctx context.Context, ds *DataSource) (http.Header, error)
}

// CacheService interface for retrieving a cached datasource.
type CacheService interface {
	// GetDatasource gets a datasource identified by datasource numeric identifier.
	GetDatasource(ctx context.Context, datasourceID int64, user identity.Requester, skipCache bool) (*DataSource, error)

	// GetDatasourceByUID gets a datasource identified by datasource unique identifier (UID).
	GetDatasourceByUID(ctx context.Context, datasourceUID string, user identity.Requester, skipCache bool) (*DataSource, error)
}
