package datasources

import (
	"context"
	"net/http"

	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"

	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/services/user"
)

// DataSourceService interface for interacting with datasources.
type DataSourceService interface {
	// GetDataSource gets a datasource.
	GetDataSource(ctx context.Context, query *GetDataSourceQuery) error

	// GetDataSources gets datasources.
	GetDataSources(ctx context.Context, query *GetDataSourcesQuery) error

	// GetAllDataSources gets all datasources.
	GetAllDataSources(ctx context.Context, query *GetAllDataSourcesQuery) error

	// GetDataSourcesByType gets datasources by type.
	GetDataSourcesByType(ctx context.Context, query *GetDataSourcesByTypeQuery) error

	// AddDataSource adds a new datasource.
	AddDataSource(ctx context.Context, cmd *AddDataSourceCommand) error

	// DeleteDataSource deletes an existing datasource.
	DeleteDataSource(ctx context.Context, cmd *DeleteDataSourceCommand) error

	// UpdateDataSource updates an existing datasource.
	UpdateDataSource(ctx context.Context, cmd *UpdateDataSourceCommand) error

	// GetDefaultDataSource gets the default datasource.
	GetDefaultDataSource(ctx context.Context, query *GetDefaultDataSourceQuery) error

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
}

// CacheService interface for retrieving a cached datasource.
type CacheService interface {
	// GetDatasource gets a datasource identified by datasource numeric identifier.
	GetDatasource(ctx context.Context, datasourceID int64, user *user.SignedInUser, skipCache bool) (*DataSource, error)

	// GetDatasourceByUID gets a datasource identified by datasource unique identifier (UID).
	GetDatasourceByUID(ctx context.Context, datasourceUID string, user *user.SignedInUser, skipCache bool) (*DataSource, error)
}
