package mssql

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/url"
	"reflect"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana-azure-sdk-go/v2/azcredentials"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/data/sqlutil"
	mssql "github.com/microsoft/go-mssqldb"
	"github.com/microsoft/go-mssqldb/azuread"
	_ "github.com/microsoft/go-mssqldb/integratedauth/krb5"

	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/mssql/kerberos"
	"github.com/grafana/grafana/pkg/tsdb/mssql/sqleng"
	"github.com/grafana/grafana/pkg/tsdb/mssql/utils"
	"github.com/grafana/grafana/pkg/util"
)

type Service struct {
	im     instancemgmt.InstanceManager
	logger log.Logger
}

const (
	azureAuthentication         = "Azure AD Authentication"
	windowsAuthentication       = "Windows Authentication"
	sqlServerAuthentication     = "SQL Server Authentication"
	kerberosRaw                 = "Windows AD: Username + password"
	kerberosKeytab              = "Windows AD: Keytab"
	kerberosCredentialCache     = "Windows AD: Credential cache"      // #nosec G101
	kerberosCredentialCacheFile = "Windows AD: Credential cache file" // #nosec G101
)

func ProvideService(cfg *setting.Cfg) *Service {
	logger := backend.NewLoggerWith("logger", "tsdb.mssql")
	return &Service{
		im:     datasource.NewInstanceManager(NewInstanceSettings(cfg, logger)),
		logger: logger,
	}
}

func (s *Service) getDataSourceHandler(ctx context.Context, pluginCtx backend.PluginContext) (*sqleng.DataSourceHandler, error) {
	i, err := s.im.Get(ctx, pluginCtx)
	if err != nil {
		return nil, err
	}
	instance := i.(*sqleng.DataSourceHandler)
	return instance, nil
}

func (s *Service) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	dsHandler, err := s.getDataSourceHandler(ctx, req.PluginContext)
	if err != nil {
		return nil, err
	}
	return dsHandler.QueryData(ctx, req)
}

func newMSSQL(ctx context.Context, driverName string, userFacingDefaultError string, rowLimit int64, dsInfo sqleng.DataSourceInfo, cnnstr string, logger log.Logger, settings backend.DataSourceInstanceSettings) (*sql.DB, *sqleng.DataSourceHandler, error) {
	var connector *mssql.Connector
	var err error
	if driverName == "azuresql" {
		connector, err = azuread.NewConnector(cnnstr)
	} else {
		connector, err = mssql.NewConnector(cnnstr)
	}

	if err != nil {
		logger.Error("mssql connector creation failed", "error", err)
		return nil, nil, fmt.Errorf("mssql connector creation failed")
	}

	proxyClient, err := settings.ProxyClient(ctx)
	if err != nil {
		logger.Error("mssql proxy creation failed", "error", err)
		return nil, nil, fmt.Errorf("mssql proxy creation failed")
	}

	if proxyClient.SecureSocksProxyEnabled() {
		dialer, err := proxyClient.NewSecureSocksProxyContextDialer()
		if err != nil {
			logger.Error("mssql proxy creation failed", "error", err)
			return nil, nil, fmt.Errorf("mssql proxy creation failed")
		}
		URL, err := ParseURL(dsInfo.URL, logger)
		if err != nil {
			return nil, nil, err
		}

		mssqlDialer, err := newMSSQLProxyDialer(URL.Hostname(), dialer)
		if err != nil {
			return nil, nil, err
		}
		// update the mssql dialer with the proxy dialer
		connector.Dialer = (mssqlDialer)
	}

	config := sqleng.DataPluginConfiguration{
		DSInfo:            dsInfo,
		MetricColumnTypes: []string{"VARCHAR", "CHAR", "NVARCHAR", "NCHAR"},
		RowLimit:          rowLimit,
	}

	queryResultTransformer := mssqlQueryResultTransformer{
		userError: userFacingDefaultError,
	}

	db := sql.OpenDB(connector)

	db.SetMaxOpenConns(config.DSInfo.JsonData.MaxOpenConns)
	db.SetMaxIdleConns(config.DSInfo.JsonData.MaxIdleConns)
	db.SetConnMaxLifetime(time.Duration(config.DSInfo.JsonData.ConnMaxLifetime) * time.Second)

	handler, err := sqleng.NewQueryDataHandler(userFacingDefaultError, db, config, &queryResultTransformer, newMssqlMacroEngine(),
		logger)
	if err != nil {
		logger.Error("Failed connecting to Postgres", "err", err)
		return nil, nil, err
	}

	logger.Debug("Successfully connected to Postgres")
	return db, handler, nil
}

func NewInstanceSettings(cfg *setting.Cfg, logger log.Logger) datasource.InstanceFactoryFunc {
	return func(ctx context.Context, settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
		grafCfg := backend.GrafanaConfigFromContext(ctx)
		sqlCfg, err := grafCfg.SQL()
		if err != nil {
			return nil, err
		}
		jsonData := sqleng.JsonData{
			MaxOpenConns:      sqlCfg.DefaultMaxOpenConns,
			MaxIdleConns:      sqlCfg.DefaultMaxIdleConns,
			ConnMaxLifetime:   sqlCfg.DefaultMaxConnLifetimeSeconds,
			Encrypt:           "false",
			ConnectionTimeout: 0,
			SecureDSProxy:     false,
		}
		azureCredentials, err := utils.GetAzureCredentials(settings)
		if err != nil {
			return nil, fmt.Errorf("error reading azure credentials")
		}

		kerberosAuth, err := kerberos.GetKerberosSettings(settings)
		if err != nil {
			return nil, fmt.Errorf("error getting kerberos settings: %w", err)
		}

		err = json.Unmarshal(settings.JSONData, &jsonData)
		if err != nil {
			return nil, fmt.Errorf("error reading settings: %w", err)
		}

		database := jsonData.Database
		if database == "" {
			database = settings.Database
		}

		dsInfo := sqleng.DataSourceInfo{
			JsonData:                jsonData,
			URL:                     settings.URL,
			User:                    settings.User,
			Database:                database,
			ID:                      settings.ID,
			Updated:                 settings.Updated,
			UID:                     settings.UID,
			DecryptedSecureJSONData: settings.DecryptedSecureJSONData,
		}
		cnnstr, err := generateConnectionString(dsInfo, cfg.Azure.ManagedIdentityClientId, cfg.Azure.AzureEntraPasswordCredentialsEnabled, azureCredentials, kerberosAuth, logger)
		if err != nil {
			return nil, err
		}

		driverName := "mssql"
		if jsonData.AuthenticationType == azureAuthentication {
			driverName = "azuresql"
		}

		userFacingDefaultError, err := grafCfg.UserFacingDefaultError()
		if err != nil {
			return nil, err
		}

		_, handler, err := newMSSQL(ctx, driverName, userFacingDefaultError, sqlCfg.RowLimit, dsInfo, cnnstr, logger, settings)
		if err != nil {
			logger.Error("Failed connecting to MSSQL", "err", err)
			return nil, err
		}

		logger.Debug("Successfully connected to MSSQL")
		return handler, nil
	}
}

// ParseURL is called also from pkg/api/datasource/validation.go,
// which uses a different logging interface,
// so we have a special minimal interface that is fulfilled by
// both places.
type DebugOnlyLogger interface {
	Debug(msg string, args ...interface{})
}

// ParseURL tries to parse an MSSQL URL string into a URL object.
func ParseURL(u string, logger DebugOnlyLogger) (*url.URL, error) {
	logger.Debug("Parsing MSSQL URL", "url", u)

	// Recognize ODBC connection strings like host\instance:1234
	reODBC := regexp.MustCompile(`^[^\\:]+(?:\\[^:]+)?(?::\d+)?(?:;.+)?$`)
	var host string
	switch {
	case reODBC.MatchString(u):
		logger.Debug("Recognized as ODBC URL format", "url", u)
		host = u
	default:
		logger.Debug("Couldn't recognize as valid MSSQL URL", "url", u)
		return nil, fmt.Errorf("unrecognized MSSQL URL format: %q", u)
	}
	return &url.URL{
		Scheme: "sqlserver",
		Host:   host,
	}, nil
}

func generateConnectionString(dsInfo sqleng.DataSourceInfo, azureManagedIdentityClientId string, azureEntraPasswordCredentialsEnabled bool, azureCredentials azcredentials.AzureCredentials, kerberosAuth kerberos.KerberosAuth, logger log.Logger) (string, error) {
	const dfltPort = "0"
	var addr util.NetworkAddress
	if dsInfo.URL != "" {
		u, err := ParseURL(dsInfo.URL, logger)
		if err != nil {
			return "", err
		}
		addr, err = util.SplitHostPortDefault(u.Host, "localhost", dfltPort)
		if err != nil {
			return "", err
		}
	} else {
		addr = util.NetworkAddress{
			Host: "localhost",
			Port: dfltPort,
		}
	}

	args := []any{
		"url", dsInfo.URL, "host", addr.Host,
	}
	if addr.Port != "0" {
		args = append(args, "port", addr.Port)
	}
	logger.Debug("Generating connection string", args...)

	encrypt := dsInfo.JsonData.Encrypt
	tlsSkipVerify := dsInfo.JsonData.TlsSkipVerify
	hostNameInCertificate := dsInfo.JsonData.Servername
	certificate := dsInfo.JsonData.RootCertFile
	connStr := fmt.Sprintf("server=%s;database=%s;",
		addr.Host,
		dsInfo.Database,
	)

	switch dsInfo.JsonData.AuthenticationType {
	case azureAuthentication:
		azureCredentialDSNFragment, err := getAzureCredentialDSNFragment(azureCredentials, azureManagedIdentityClientId, azureEntraPasswordCredentialsEnabled)
		if err != nil {
			return "", err
		}
		connStr += azureCredentialDSNFragment
	case windowsAuthentication:
		// No user id or password. We're using windows single sign on.
	case kerberosRaw, kerberosKeytab, kerberosCredentialCacheFile, kerberosCredentialCache:
		connStr = kerberos.Krb5ParseAuthCredentials(addr.Host, addr.Port, dsInfo.Database, dsInfo.User, dsInfo.DecryptedSecureJSONData["password"], kerberosAuth)
	default:
		connStr += fmt.Sprintf("user id=%s;password=%s;", dsInfo.User, dsInfo.DecryptedSecureJSONData["password"])
	}

	// Port number 0 means to determine the port automatically, so we can let the driver choose
	if addr.Port != "0" {
		connStr += fmt.Sprintf("port=%s;", addr.Port)
	}
	switch encrypt {
	case "true":
		connStr += fmt.Sprintf("encrypt=%s;TrustServerCertificate=%t;", encrypt, tlsSkipVerify)
		if hostNameInCertificate != "" {
			connStr += fmt.Sprintf("hostNameInCertificate=%s;", hostNameInCertificate)
		}

		if certificate != "" {
			connStr += fmt.Sprintf("certificate=%s;", certificate)
		}
	case "disable":
		connStr += fmt.Sprintf("encrypt=%s;", dsInfo.JsonData.Encrypt)
	}

	if dsInfo.JsonData.ConnectionTimeout != 0 {
		connStr += fmt.Sprintf("connection timeout=%d;", dsInfo.JsonData.ConnectionTimeout)
	}

	return connStr, nil
}

func getAzureCredentialDSNFragment(azureCredentials azcredentials.AzureCredentials, azureManagedIdentityClientId string, azureEntraPasswordCredentialsEnabled bool) (string, error) {
	connStr := ""
	switch c := azureCredentials.(type) {
	case *azcredentials.AzureManagedIdentityCredentials:
		if azureManagedIdentityClientId != "" {
			connStr += fmt.Sprintf("user id=%s;", azureManagedIdentityClientId)
		}
		connStr += fmt.Sprintf("fedauth=%s;",
			"ActiveDirectoryManagedIdentity")
	case *azcredentials.AzureClientSecretCredentials:
		connStr += fmt.Sprintf("user id=%s@%s;password=%s;fedauth=%s;",
			c.ClientId,
			c.TenantId,
			c.ClientSecret,
			"ActiveDirectoryApplication",
		)
	case *azcredentials.AzureEntraPasswordCredentials:
		if azureEntraPasswordCredentialsEnabled {
			connStr += fmt.Sprintf("user id=%s;password=%s;applicationclientid=%s;fedauth=%s;",
				c.UserId,
				c.Password,
				c.ClientId,
				"ActiveDirectoryPassword",
			)
		} else {
			return "", fmt.Errorf("azure entra password authentication is not enabled")
		}
	default:
		return "", fmt.Errorf("unsupported azure authentication type")
	}
	return connStr, nil
}

type mssqlQueryResultTransformer struct {
	userError string
}

func (t *mssqlQueryResultTransformer) TransformQueryError(logger log.Logger, err error) error {
	// go-mssql overrides source error, so we currently match on string
	// ref https://github.com/denisenkom/go-mssqldb/blob/045585d74f9069afe2e115b6235eb043c8047043/tds.go#L904
	if strings.HasPrefix(strings.ToLower(err.Error()), "unable to open tcp connection with host") {
		logger.Error("Query error", "error", err)
		return fmt.Errorf("failed to connect to server - %s", t.userError)
	}

	return err
}

// CheckHealth pings the connected SQL database
func (s *Service) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	dsHandler, err := s.getDataSourceHandler(ctx, req.PluginContext)
	if err != nil {
		return nil, err
	}

	return dsHandler.CheckHealth(ctx, req)
}

func (t *mssqlQueryResultTransformer) GetConverterList() []sqlutil.StringConverter {
	return []sqlutil.StringConverter{
		{
			Name:           "handle MONEY",
			InputScanKind:  reflect.Slice,
			InputTypeName:  "MONEY",
			ConversionFunc: func(in *string) (*string, error) { return in, nil },
			Replacer: &sqlutil.StringFieldReplacer{
				OutputFieldType: data.FieldTypeNullableFloat64,
				ReplaceFunc: func(in *string) (any, error) {
					if in == nil {
						return nil, nil
					}
					v, err := strconv.ParseFloat(*in, 64)
					if err != nil {
						return nil, err
					}
					return &v, nil
				},
			},
		},
		{
			Name:           "handle SMALLMONEY",
			InputScanKind:  reflect.Slice,
			InputTypeName:  "SMALLMONEY",
			ConversionFunc: func(in *string) (*string, error) { return in, nil },
			Replacer: &sqlutil.StringFieldReplacer{
				OutputFieldType: data.FieldTypeNullableFloat64,
				ReplaceFunc: func(in *string) (any, error) {
					if in == nil {
						return nil, nil
					}
					v, err := strconv.ParseFloat(*in, 64)
					if err != nil {
						return nil, err
					}
					return &v, nil
				},
			},
		},
		{
			Name:           "handle DECIMAL",
			InputScanKind:  reflect.Slice,
			InputTypeName:  "DECIMAL",
			ConversionFunc: func(in *string) (*string, error) { return in, nil },
			Replacer: &sqlutil.StringFieldReplacer{
				OutputFieldType: data.FieldTypeNullableFloat64,
				ReplaceFunc: func(in *string) (any, error) {
					if in == nil {
						return nil, nil
					}
					v, err := strconv.ParseFloat(*in, 64)
					if err != nil {
						return nil, err
					}
					return &v, nil
				},
			},
		},
		{
			Name:           "handle UNIQUEIDENTIFIER",
			InputScanKind:  reflect.Slice,
			InputTypeName:  "UNIQUEIDENTIFIER",
			ConversionFunc: func(in *string) (*string, error) { return in, nil },
			Replacer: &sqlutil.StringFieldReplacer{
				OutputFieldType: data.FieldTypeNullableString,
				ReplaceFunc: func(in *string) (any, error) {
					if in == nil {
						return nil, nil
					}
					uuid := &mssql.UniqueIdentifier{}
					if err := uuid.Scan([]byte(*in)); err != nil {
						return nil, err
					}
					v := uuid.String()
					return &v, nil
				},
			},
		},
		{
			Name:           "handle SQL_VARIANT",
			InputScanKind:  reflect.Pointer,
			InputTypeName:  "SQL_VARIANT",
			ConversionFunc: func(in *string) (*string, error) { return in, nil },
			Replacer: &sqlutil.StringFieldReplacer{
				OutputFieldType: data.FieldTypeNullableString,
				ReplaceFunc: func(in *string) (any, error) {
					if in == nil {
						return nil, nil
					}
					return in, nil
				},
			},
		},
	}
}
