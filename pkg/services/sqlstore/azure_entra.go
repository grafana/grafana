package sqlstore

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"errors"
	"fmt"
	"strings"

	"github.com/go-sql-driver/mysql"
	"github.com/grafana/grafana-azure-sdk-go/v2/azcredentials"
	"github.com/grafana/grafana-azure-sdk-go/v2/azsettings"
	"github.com/grafana/grafana-azure-sdk-go/v2/aztokenprovider"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/util/xorm"
)

var azureEntraLog = log.New("sqlstore.azure_entra")

// Microsoft Entra ID authentication for Azure Database for MySQL.
//
// Azure Database for MySQL accepts a Microsoft Entra ID access token in place of a
// password, sent with the mysql_clear_password plugin. A token is valid for at most
// an hour and the server only checks it when a connection is opened, so Grafana gets
// a token for every new connection instead of using a static password. The tokens
// come from the managed identity or workload identity configured in [azure], through
// the token cache of grafana-azure-sdk-go, which renews a token shortly before it
// expires.

// ossrdbmsResourceIDProperty is the Azure cloud property that holds the resource ID of
// Azure Database for MySQL and PostgreSQL, e.g. https://ossrdbms-aad.database.windows.net.
const ossrdbmsResourceIDProperty = "ossrdbmsResourceId"

// azureEntraTokenFunc returns an access token for Azure Database for MySQL.
type azureEntraTokenFunc func(ctx context.Context) (string, error)

// newAzureEntraTokenFunc returns a token source for the identity configured in [azure]:
// workload identity when it's enabled, managed identity otherwise.
func newAzureEntraTokenFunc(settings *azsettings.AzureSettings) (azureEntraTokenFunc, error) {
	if settings == nil {
		return nil, errors.New("azure settings are missing")
	}

	var credentials azcredentials.AzureCredentials
	switch {
	case settings.WorkloadIdentityEnabled:
		credentials = &azcredentials.AzureWorkloadIdentityCredentials{}
	case settings.ManagedIdentityEnabled:
		credentials = &azcredentials.AzureManagedIdentityCredentials{}
	default:
		return nil, errors.New("enable workload_identity_enabled or managed_identity_enabled in [azure]")
	}

	cloudName, err := azcredentials.GetAzureCloud(settings, credentials)
	if err != nil {
		return nil, err
	}
	cloud, err := settings.GetCloud(cloudName)
	if err != nil {
		return nil, err
	}
	resourceID := strings.TrimSuffix(cloud.Properties[ossrdbmsResourceIDProperty], "/")
	if resourceID == "" {
		return nil, fmt.Errorf("the Azure cloud %q has no %q property; set it in [azure] clouds_config", cloudName, ossrdbmsResourceIDProperty)
	}
	scopes := []string{resourceID + "/.default"}

	provider, err := aztokenprovider.NewAzureAccessTokenProvider(settings, credentials, false)
	if err != nil {
		return nil, err
	}

	return func(ctx context.Context) (string, error) {
		return provider.GetAccessToken(ctx, scopes)
	}, nil
}

// azureEntraMySQLDriver opens MySQL connections that sign in with a fresh access token.
// It ignores any password in the data source name.
type azureEntraMySQLDriver struct {
	getToken azureEntraTokenFunc
}

var _ driver.DriverContext = azureEntraMySQLDriver{}

func (d azureEntraMySQLDriver) OpenConnector(dsn string) (driver.Connector, error) {
	cfg, err := mysql.ParseDSN(dsn)
	if err != nil {
		return nil, err
	}
	// The token is sent as a cleartext password; NewDatabaseConfig makes sure TLS is on.
	cfg.AllowCleartextPasswords = true

	getToken := d.getToken
	err = cfg.Apply(mysql.BeforeConnect(func(ctx context.Context, cfg *mysql.Config) error {
		token, err := getToken(ctx)
		if err != nil {
			return fmt.Errorf("failed to get a Microsoft Entra ID access token for the database: %w", err)
		}
		cfg.Passwd = token
		return nil
	}))
	if err != nil {
		return nil, err
	}

	return mysql.NewConnector(cfg)
}

// Open is what database/sql calls when the driver is wrapped by sqlhooks
// (instrument_queries), since the wrapper only implements driver.Driver.
func (d azureEntraMySQLDriver) Open(dsn string) (driver.Conn, error) {
	connector, err := d.OpenConnector(dsn)
	if err != nil {
		return nil, err
	}
	return connector.Connect(context.Background())
}

// dsnConnector opens every connection with drv.Open(dsn), like sql.Open does for a
// driver that doesn't implement driver.DriverContext.
type dsnConnector struct {
	dsn string
	drv driver.Driver
}

func (c dsnConnector) Connect(context.Context) (driver.Conn, error) {
	return c.drv.Open(c.dsn)
}

func (c dsnConnector) Driver() driver.Driver {
	return c.drv
}

// OpenEngine opens an xorm engine for the database. With azure_entra_auth_enabled, its
// connections sign in with Microsoft Entra ID access tokens; otherwise this is
// xorm.NewEngine(dbCfg.Type, dbCfg.ConnectionString).
func (dbCfg *DatabaseConfig) OpenEngine() (*xorm.Engine, error) {
	return dbCfg.openEngine(dbCfg.Type, dbCfg.ConnectionString, nil)
}

// openEngine opens an xorm engine with the given driver name and connection string.
// wrapDriver, if set, wraps the driver that opens the connections (used for
// instrument_queries); it's only needed when azure_entra_auth_enabled is on, since
// otherwise the driver registered as driverName is already wrapped.
func (dbCfg *DatabaseConfig) openEngine(driverName, connectionString string, wrapDriver func(driver.Driver) driver.Driver) (*xorm.Engine, error) {
	if !dbCfg.AzureEntraAuth {
		return xorm.NewEngine(driverName, connectionString)
	}
	if dbCfg.azureEntraToken == nil {
		return nil, errors.New("azure_entra_auth_enabled is set but no token source was configured")
	}

	entraDriver := azureEntraMySQLDriver{getToken: dbCfg.azureEntraToken}

	var connector driver.Connector
	if wrapDriver != nil {
		connector = dsnConnector{dsn: connectionString, drv: wrapDriver(entraDriver)}
	} else {
		var err error
		if connector, err = entraDriver.OpenConnector(connectionString); err != nil {
			return nil, err
		}
	}

	db := sql.OpenDB(connector)
	engine, err := xorm.NewEngineWithDB(driverName, connectionString, db)
	if err != nil {
		_ = db.Close()
		return nil, err
	}
	return engine, nil
}
