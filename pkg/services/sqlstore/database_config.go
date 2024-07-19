package sqlstore

import (
	"context"
	"database/sql/driver"
	"errors"
	"fmt"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/go-sql-driver/mysql"
	"github.com/lib/pq"

	"github.com/grafana/grafana-azure-sdk-go/v2/azcredentials"
	"github.com/grafana/grafana-azure-sdk-go/v2/azsettings"
	"github.com/grafana/grafana-azure-sdk-go/v2/aztokenprovider"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

type DatabaseConfig struct {
	Type                        string
	Host                        string
	Name                        string
	User                        string
	Pwd                         string
	Path                        string
	SslMode                     string
	SSLSNI                      string
	CaCertPath                  string
	ClientKeyPath               string
	ClientCertPath              string
	ServerCertName              string
	ConnectionString            string
	ConnectorCreator            func(connectionString string) (driver.Connector, error)
	IsolationLevel              string
	MaxOpenConn                 int
	MaxIdleConn                 int
	ConnMaxLifetime             int
	CacheMode                   string
	WALEnabled                  bool
	UrlQueryParams              map[string][]string
	SkipMigrations              bool
	MigrationLock               bool
	MigrationLockAttemptTimeout int
	LogQueries                  bool
	// SQLite only
	QueryRetries int
	// SQLite only
	TransactionRetries int
	// MySQL & Postgres Only
	AzureManagedIdentityEnabled bool
}

func NewDatabaseConfig(cfg *setting.Cfg, features featuremgmt.FeatureToggles) (*DatabaseConfig, error) {
	if cfg == nil {
		return nil, errors.New("cfg cannot be nil")
	}

	dbCfg := &DatabaseConfig{}
	if err := dbCfg.readConfig(cfg); err != nil {
		return nil, err
	}

	dbCfg.buildGetConnector(cfg)

	if err := dbCfg.buildConnectionString(cfg, features); err != nil {
		return nil, err
	}

	return dbCfg, nil
}

// readConfigSection reads the database configuration from the given block of
// the configuration file. This method allows us to add a "database_replica"
// section to the configuration file while using the same cfg struct.
func (dbCfg *DatabaseConfig) readConfigSection(cfg *setting.Cfg, section string) error {
	sec := cfg.Raw.Section(section)
	cfgURL := sec.Key("url").String()
	if len(cfgURL) != 0 {
		dbURL, err := url.Parse(cfgURL)
		if err != nil {
			return err
		}
		dbCfg.Type = dbURL.Scheme
		dbCfg.Host = dbURL.Host

		pathSplit := strings.Split(dbURL.Path, "/")
		if len(pathSplit) > 1 {
			dbCfg.Name = pathSplit[1]
		}

		userInfo := dbURL.User
		if userInfo != nil {
			dbCfg.User = userInfo.Username()
			dbCfg.Pwd, _ = userInfo.Password()
		}

		dbCfg.UrlQueryParams = dbURL.Query()
	} else {
		dbCfg.Type = sec.Key("type").String()
		dbCfg.Host = sec.Key("host").String()
		dbCfg.Name = sec.Key("name").String()
		dbCfg.User = sec.Key("user").String()
		dbCfg.ConnectionString = sec.Key("connection_string").String()
		dbCfg.Pwd = sec.Key("password").String()
	}

	dbCfg.MaxOpenConn = sec.Key("max_open_conn").MustInt(0)
	dbCfg.MaxIdleConn = sec.Key("max_idle_conn").MustInt(2)
	dbCfg.ConnMaxLifetime = sec.Key("conn_max_lifetime").MustInt(14400)
	dbCfg.SslMode = sec.Key("ssl_mode").String()
	dbCfg.SSLSNI = sec.Key("ssl_sni").String()
	dbCfg.CaCertPath = sec.Key("ca_cert_path").String()
	dbCfg.ClientKeyPath = sec.Key("client_key_path").String()
	dbCfg.ClientCertPath = sec.Key("client_cert_path").String()
	dbCfg.ServerCertName = sec.Key("server_cert_name").String()
	dbCfg.Path = sec.Key("path").MustString("data/grafana.db")
	dbCfg.IsolationLevel = sec.Key("isolation_level").String()
	dbCfg.CacheMode = sec.Key("cache_mode").MustString("private")
	dbCfg.WALEnabled = sec.Key("wal").MustBool(false)
	dbCfg.SkipMigrations = sec.Key("skip_migrations").MustBool()
	dbCfg.MigrationLock = sec.Key("migration_locking").MustBool(true)
	dbCfg.MigrationLockAttemptTimeout = sec.Key("locking_attempt_timeout_sec").MustInt()
	dbCfg.QueryRetries = sec.Key("query_retries").MustInt()
	dbCfg.TransactionRetries = sec.Key("transaction_retries").MustInt(5)
	dbCfg.LogQueries = sec.Key("log_queries").MustBool(false)
	dbCfg.AzureManagedIdentityEnabled = sec.Key("azure_managed_identity_enabled").MustBool(false)
	return nil
}

// readConfig is a wrapper around readConfigSection that read the "database" configuration block.
func (dbCfg *DatabaseConfig) readConfig(cfg *setting.Cfg) error {
	return dbCfg.readConfigSection(cfg, "database")
}

func (dbCfg *DatabaseConfig) buildConnectionString(cfg *setting.Cfg, features featuremgmt.FeatureToggles) error {
	if dbCfg.ConnectionString != "" {
		return nil
	}

	cnnstr := ""

	switch dbCfg.Type {
	case migrator.MySQL:
		protocol := "tcp"
		if strings.HasPrefix(dbCfg.Host, "/") {
			protocol = "unix"
		}

		cnnstr = fmt.Sprintf("%s:%s@%s(%s)/%s?collation=utf8mb4_unicode_ci&allowNativePasswords=true&clientFoundRows=true",
			dbCfg.User, dbCfg.Pwd, protocol, dbCfg.Host, dbCfg.Name)

		if dbCfg.SslMode == "true" || dbCfg.SslMode == "skip-verify" {
			tlsCert, err := makeCert(dbCfg)
			if err != nil {
				return err
			}
			if err := mysql.RegisterTLSConfig("custom", tlsCert); err != nil {
				return err
			}

			cnnstr += "&tls=custom"
		}

		if isolation := dbCfg.IsolationLevel; isolation != "" {
			val := url.QueryEscape(fmt.Sprintf("'%s'", isolation))
			cnnstr += fmt.Sprintf("&transaction_isolation=%s", val)
		}

		if features != nil && features.IsEnabledGlobally(featuremgmt.FlagMysqlAnsiQuotes) {
			cnnstr += "&sql_mode='ANSI_QUOTES'"
		}

		cnnstr += buildExtraConnectionString('&', dbCfg.UrlQueryParams)
	case migrator.Postgres:
		addr, err := util.SplitHostPortDefault(dbCfg.Host, "127.0.0.1", "5432")
		if err != nil {
			return fmt.Errorf("invalid host specifier '%s': %w", dbCfg.Host, err)
		}

		args := []any{dbCfg.User, addr.Host, addr.Port, dbCfg.Name, dbCfg.SslMode, dbCfg.ClientCertPath,
			dbCfg.ClientKeyPath, dbCfg.CaCertPath}

		for i, arg := range args {
			if arg == "" {
				args[i] = "''"
			}
		}
		cnnstr = fmt.Sprintf("user=%s host=%s port=%s dbname=%s sslmode=%s sslcert=%s sslkey=%s sslrootcert=%s", args...)
		if dbCfg.SSLSNI != "" {
			cnnstr += fmt.Sprintf(" sslsni=%s", dbCfg.SSLSNI)
		}
		if dbCfg.Pwd != "" {
			cnnstr += fmt.Sprintf(" password=%s", dbCfg.Pwd)
		}

		cnnstr += buildExtraConnectionString(' ', dbCfg.UrlQueryParams)
	case migrator.SQLite:
		// special case for tests
		if !filepath.IsAbs(dbCfg.Path) {
			dbCfg.Path = filepath.Join(cfg.DataPath, dbCfg.Path)
		}
		if err := os.MkdirAll(path.Dir(dbCfg.Path), 0o750); err != nil {
			return err
		}

		cnnstr = fmt.Sprintf("file:%s?cache=%s&mode=rwc", dbCfg.Path, dbCfg.CacheMode)

		if dbCfg.WALEnabled {
			cnnstr += "&_journal_mode=WAL"
		}

		cnnstr += buildExtraConnectionString('&', dbCfg.UrlQueryParams)
	default:
		return fmt.Errorf("unknown database type: %s", dbCfg.Type)
	}

	dbCfg.ConnectionString = cnnstr

	return nil
}

func buildExtraConnectionString(sep rune, urlQueryParams map[string][]string) string {
	if urlQueryParams == nil {
		return ""
	}

	var sb strings.Builder
	for key, values := range urlQueryParams {
		for _, value := range values {
			sb.WriteRune(sep)
			sb.WriteString(key)
			sb.WriteRune('=')
			sb.WriteString(value)
		}
	}
	return sb.String()
}

func (dbCfg *DatabaseConfig) buildGetConnector(cfg *setting.Cfg) {
	if dbCfg.Type != migrator.MySQL && dbCfg.Type != migrator.Postgres {
		dbCfg.ConnectorCreator = nil
		return
	}

	var getPassword func() (string, error)
	if cfg.AzureAuthEnabled {
		var credentials azcredentials.AzureCredentials
		settings := cfg.Azure

		if dbCfg.AzureManagedIdentityEnabled {
			credentials = &azcredentials.AzureManagedIdentityCredentials{}
		}

		if credentials != nil {
			var azTokenProvider aztokenprovider.AzureTokenProvider
			var scopes []string
			getPassword = func() (string, error) {
				var err error
				if azTokenProvider == nil {
					var provider aztokenprovider.AzureTokenProvider
					if provider, err = aztokenprovider.NewAzureAccessTokenProvider(settings, credentials, false); err != nil {
						return "", fmt.Errorf("failed to create access token provider: %w", err)
					}

					var azureCloud string
					if azureCloud, err = azcredentials.GetAzureCloud(settings, credentials); err != nil {
						return "", fmt.Errorf("failed to get azure cloud: %w", err)
					}

					var cloudSettings *azsettings.AzureCloudSettings
					if cloudSettings, err = settings.GetCloud(azureCloud); err != nil {
						return "", fmt.Errorf("failed to get azure cloud settings of %v: %w", azureCloud, err)
					}

					resourceIdS, ok := cloudSettings.Properties["ossrdbmsResourceId"]
					if !ok {
						err := fmt.Errorf("the Azure cloud '%s' doesn't have configuration for ossrdbms", azureCloud)
						return "", err
					}

					if scopes, err = audienceToScopes(resourceIdS); err != nil {
						return "", err
					}

					azTokenProvider = provider
				}

				var token string
				if token, err = azTokenProvider.GetAccessToken(context.TODO(), scopes); err != nil {
					return "", fmt.Errorf("failed to get access token: %w", err)
				}

				return token, nil
			}
		}
	}

	switch dbCfg.Type {
	case migrator.MySQL:
		dbCfg.ConnectorCreator = mysql.MySQLDriver{}.OpenConnector
	case migrator.Postgres:
		dbCfg.ConnectorCreator = func(staticConnectionString string) (driver.Connector, error) {
			var err error

			if strings.HasPrefix(staticConnectionString, "postgres://") || strings.HasPrefix(staticConnectionString, "postgresql://") {
				staticConnectionString, err = pq.ParseURL(staticConnectionString)
				if err != nil {
					return nil, err
				}
			}

			return DynamicConnector{
				callback: func() (driver.Connector, error) {
					connectionString := staticConnectionString
					if getPassword != nil {
						if dynamicPassword, err := getPassword(); err != nil {
							return nil, fmt.Errorf("failed to get dynamic password: %w", err)
						} else {
							connectionString += fmt.Sprintf(" password='%s'", strings.ReplaceAll(dynamicPassword, "'", "\\'"))
						}
					}
					return pq.NewConnector(connectionString)
				},
				driver: pq.Driver{},
			}, nil
		}
	}
}

func audienceToScopes(audience string) ([]string, error) {
	resourceId, err := url.Parse(audience)
	if err != nil || resourceId.Scheme == "" || resourceId.Host == "" {
		err = fmt.Errorf("endpoint resource ID (audience) '%s' invalid", audience)
		return nil, err
	}

	resourceId.Path = path.Join(resourceId.Path, ".default")
	scopes := []string{resourceId.String()}
	return scopes, nil
}

// Dynamic Connector

type DynamicConnector struct {
	callback func() (driver.Connector, error)
	driver   driver.Driver
}

func (d DynamicConnector) Driver() driver.Driver {
	return d.driver
}

func (d DynamicConnector) Connect(ctx context.Context) (driver.Conn, error) {
	connector, err := d.callback()

	if err != nil {
		return nil, fmt.Errorf("error instantiating dynamic connector: %w", err)
	}

	return connector.Connect(ctx)
}
