package postgres

import (
	"context"
	"encoding/json"
	"fmt"
	"reflect"
	"strconv"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/data/sqlutil"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/coreplugin"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/errutil"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/tsdb/sqleng"
)

type Service struct {
	cfg                  *setting.Cfg          `inject:""`
	BackendPluginManager backendplugin.Manager `inject:""`
	logger               log.Logger
	tlsManager           tlsSettingsProvider
	im                   instancemgmt.InstanceManager
}

func init() {
	registry.Register(&registry.Descriptor{Instance: &Service{}})
}

func (s *Service) Init() error {
	s.logger = log.New("tsdb.postgres")
	s.tlsManager = newTLSManager(s.logger, s.cfg.DataPath)
	s.im = datasource.NewInstanceManager(newInstanceSettings())
	factory := coreplugin.New(backend.ServeOpts{QueryDataHandler: s})

	if err := s.BackendPluginManager.Register("postgres", factory); err != nil {
		s.logger.Error("Failed to register plugin", "error", err)
	}
	return nil
}

func (s *Service) getDSInfo(pluginCtx backend.PluginContext) (*sqleng.DataSourceInfo, error) {
	i, err := s.im.Get(pluginCtx)
	if err != nil {
		return nil, err
	}
	instance := i.(sqleng.DataSourceInfo)
	return &instance, nil
}

func newInstanceSettings() datasource.InstanceFactoryFunc {
	return func(settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
		type JSONData struct {
			SSLMode                string `json:"sslmode"`
			TLSConfigurationMethod string `json:"tlsConfigurationMethod"`
			Timescaledb            bool   `json:"timescaledb"`
			SSLRootCertFile        string `json:"sslRootCertFile"`
			SSLCertFile            string `json:"sslCertFile"`
			SSLKeyFile             string `json:"sslKeyFile"`
		}

		// set up defaults
		jsonData := JSONData{
			SSLMode:                "verify-full",
			TLSConfigurationMethod: "file-path",
			Timescaledb:            false,
		}

		err := json.Unmarshal(settings.JSONData, &jsonData)
		if err != nil {
			return nil, fmt.Errorf("error reading settings: %w", err)
		}

		model := sqleng.DatasourceInfo{
			DatasourceID:           settings.ID,
			Uid:                    settings.UID,
			Url:                    settings.URL,
			User:                   settings.User,
			Database:               settings.Database,
			Updated:                settings.Updated,
			SSLmode:                strings.TrimSpace(strings.ToLower(jsonData.SSLMode)),
			TLSConfigurationMethod: strings.TrimSpace(strings.ToLower(jsonData.TLSConfigurationMethod)),
			Timescaledb:            jsonData.Timescaledb,
			SSLRootCertFile:        jsonData.SSLRootCertFile,
			SSLCertFile:            jsonData.SSLCertFile,
			SSLKeyFile:             jsonData.SSLKeyFile,
		}

		model.Password = settings.DecryptedSecureJSONData["password"]
		model.TLSCACert = settings.DecryptedSecureJSONData["tlsCACert"]
		model.TLSClientCert = settings.DecryptedSecureJSONData["tlsClientCert"]
		model.TLSClientKey = settings.DecryptedSecureJSONData["tlsClientKey"]

		return model, nil
	}
}

// escape single quotes and backslashes in Postgres connection string parameters.
func escape(input string) string {
	return strings.ReplaceAll(strings.ReplaceAll(input, `\`, `\\`), "'", `\'`)
}

func (s *Service) generateConnectionString(dsInfo *sqleng.DatasourceInfo) (string, error) {
	var host string
	var port int
	if strings.HasPrefix(dsInfo.Url, "/") {
		host = dsInfo.Url
		s.logger.Debug("Generating connection string with Unix socket specifier", "socket", host)
	} else {
		sp := strings.SplitN(dsInfo.Url, ":", 2)
		host = sp[0]
		if len(sp) > 1 {
			var err error
			port, err = strconv.Atoi(sp[1])
			if err != nil {
				return "", errutil.Wrapf(err, "invalid port in host specifier %q", sp[1])
			}

			s.logger.Debug("Generating connection string with network host/port pair", "host", host, "port", port)
		} else {
			s.logger.Debug("Generating connection string with network host", "host", host)
		}
	}

	connStr := fmt.Sprintf("user='%s' password='%s' host='%s' dbname='%s'",
		escape(dsInfo.User), escape(dsInfo.Password), escape(host), escape(dsInfo.Database))
	if port > 0 {
		connStr += fmt.Sprintf(" port=%d", port)
	}

	tlsSettings, err := s.tlsManager.getTLSSettings(dsInfo)
	if err != nil {
		return "", err
	}

	connStr += fmt.Sprintf(" sslmode='%s'", escape(tlsSettings.Mode))

	// Attach root certificate if provided
	if tlsSettings.RootCertFile != "" {
		s.logger.Debug("Setting server root certificate", "tlsRootCert", tlsSettings.RootCertFile)
		connStr += fmt.Sprintf(" sslrootcert='%s'", escape(tlsSettings.RootCertFile))
	}

	// Attach client certificate and key if both are provided
	if tlsSettings.CertFile != "" && tlsSettings.CertKeyFile != "" {
		s.logger.Debug("Setting TLS/SSL client auth", "tlsCert", tlsSettings.CertFile, "tlsKey", tlsSettings.CertKeyFile)
		connStr += fmt.Sprintf(" sslcert='%s' sslkey='%s'", escape(tlsSettings.CertFile), escape(tlsSettings.CertKeyFile))
	} else if tlsSettings.CertFile != "" || tlsSettings.CertKeyFile != "" {
		return "", fmt.Errorf("TLS/SSL client certificate and key must both be specified")
	}

	s.logger.Debug("Generated Postgres connection string successfully")
	return connStr, nil
}

func (s *Service) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataHandler, error) {
	s.logger.Debug("Creating Postgres query endpoint")
	dsInfo, err := s.getDSInfo(req.PluginContext)
	if err != nil {
		return nil, err
	}

	cnnstr, err := s.generateConnectionString(dsInfo)

	if s.cfg.Env == setting.Dev {
		s.logger.Debug("getEngine", "connection", cnnstr)
	}

	config := sqleng.DataPluginConfiguration{
		DriverName:        "postgres",
		ConnectionString:  cnnstr,
		Datasource:        dsInfo,
		MetricColumnTypes: []string{"UNKNOWN", "TEXT", "VARCHAR", "CHAR"},
	}

	queryResultTransformer := postgresQueryResultTransformer{
		log: s.logger,
	}

	plugin, err := sqleng.NewQueryDataHandler(config, &queryResultTransformer, newPostgresMacroEngine(dsInfo.Timescaledb),
		s.logger)
	if err != nil {
		s.logger.Error("Failed connecting to Postgres", "err", err)
		return nil, err
	}

	s.logger.Debug("Successfully connected to Postgres")
	return &plugin, nil
}

type postgresQueryResultTransformer struct {
	log log.Logger
}

func (t *postgresQueryResultTransformer) TransformQueryError(err error) error {
	return err
}

func (t *postgresQueryResultTransformer) GetConverterList() []sqlutil.StringConverter {
	return []sqlutil.StringConverter{
		{
			Name:           "handle FLOAT4",
			InputScanKind:  reflect.Interface,
			InputTypeName:  "FLOAT4",
			ConversionFunc: func(in *string) (*string, error) { return in, nil },
			Replacer: &sqlutil.StringFieldReplacer{
				OutputFieldType: data.FieldTypeNullableFloat64,
				ReplaceFunc: func(in *string) (interface{}, error) {
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
			Name:           "handle FLOAT8",
			InputScanKind:  reflect.Interface,
			InputTypeName:  "FLOAT8",
			ConversionFunc: func(in *string) (*string, error) { return in, nil },
			Replacer: &sqlutil.StringFieldReplacer{
				OutputFieldType: data.FieldTypeNullableFloat64,
				ReplaceFunc: func(in *string) (interface{}, error) {
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
			Name:           "handle NUMERIC",
			InputScanKind:  reflect.Interface,
			InputTypeName:  "NUMERIC",
			ConversionFunc: func(in *string) (*string, error) { return in, nil },
			Replacer: &sqlutil.StringFieldReplacer{
				OutputFieldType: data.FieldTypeNullableFloat64,
				ReplaceFunc: func(in *string) (interface{}, error) {
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
	}
}
