package datasources

import (
	"context"
	"net/http"

	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/models"
)

// DataSourceService interface for interacting with datasources.
type DataSourceService interface {
	// GetDataSource gets a datasource.
	GetDataSource(ctx context.Context, query *models.GetDataSourceQuery) error

	// GetDataSources gets datasources.
	GetDataSources(ctx context.Context, query *models.GetDataSourcesQuery) error

	// GetDataSourcesByType gets datasources by type.
	GetDataSourcesByType(ctx context.Context, query *models.GetDataSourcesByTypeQuery) error

	// AddDataSource adds a new datasource.
	AddDataSource(ctx context.Context, cmd *models.AddDataSourceCommand) error

	// DeleteDataSource deletes an existing datasource.
	DeleteDataSource(ctx context.Context, cmd *models.DeleteDataSourceCommand) error

	// UpdateDataSource updates an existing datasource.
	UpdateDataSource(ctx context.Context, cmd *models.UpdateDataSourceCommand) error

	// GetDefaultDataSource gets the default datasource.
	GetDefaultDataSource(ctx context.Context, query *models.GetDefaultDataSourceQuery) error

	// GetHTTPTransport gets a datasource specific HTTP transport.
	GetHTTPTransport(ds *models.DataSource, provider httpclient.Provider, customMiddlewares ...sdkhttpclient.Middleware) (http.RoundTripper, error)

	// DecryptedValues decrypts the encrypted secureJSONData of the provided datasource and
	// returns the decrypted values.
	DecryptedValues(ds *models.DataSource) map[string]string

	// DecryptedValue decrypts the encrypted datasource secureJSONData identified by key
	// and returns the decryped value.
	DecryptedValue(ds *models.DataSource, key string) (string, bool)

	// DecryptedBasicAuthPassword decrypts the encrypted datasource basic authentication
	// password and returns the decryped value.
	DecryptedBasicAuthPassword(ds *models.DataSource) string

	// DecryptedPassword decrypts the encrypted datasource password and returns the
	// decryped value.
	DecryptedPassword(ds *models.DataSource) string
}

// CacheService interface for retrieving a cached datasource.
type CacheService interface {
	// GetDatasource gets a datasource identified by datasource numeric identifier.
	GetDatasource(ctx context.Context, datasourceID int64, user *models.SignedInUser, skipCache bool) (*models.DataSource, error)

	// GetDatasourceByUID gets a datasource identified by datasource unique identifier (UID).
	GetDatasourceByUID(ctx context.Context, datasourceUID string, user *models.SignedInUser, skipCache bool) (*models.DataSource, error)
}
