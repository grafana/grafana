package models

import (
	"errors"
	"time"

	"github.com/grafana/grafana/pkg/components/securejsondata"
	"github.com/grafana/grafana/pkg/components/simplejson"
)

const (
	DS_GRAPHITE      = "graphite"
	DS_INFLUXDB      = "influxdb"
	DS_INFLUXDB_08   = "influxdb_08"
	DS_ES            = "elasticsearch"
	DS_OPENTSDB      = "opentsdb"
	DS_CLOUDWATCH    = "cloudwatch"
	DS_KAIROSDB      = "kairosdb"
	DS_PROMETHEUS    = "prometheus"
	DS_POSTGRES      = "postgres"
	DS_MYSQL         = "mysql"
	DS_MSSQL         = "mssql"
	DS_ACCESS_DIRECT = "direct"
	DS_ACCESS_PROXY  = "proxy"
	DS_STACKDRIVER   = "stackdriver"
	DS_AZURE_MONITOR = "grafana-azure-monitor-datasource"
	DS_LOKI          = "loki"
)

var (
	ErrDataSourceNotFound           = errors.New("Data source not found")
	ErrDataSourceNameExists         = errors.New("Data source with same name already exists")
	ErrDataSourceUpdatingOldVersion = errors.New("Trying to update old version of datasource")
	ErrDatasourceIsReadOnly         = errors.New("Data source is readonly. Can only be updated from configuration")
	ErrDataSourceAccessDenied       = errors.New("Data source access denied")
)

type DsAccess string

type DataSource struct {
	Id      int64
	OrgId   int64
	Version int

	Name              string
	Type              string
	Access            DsAccess
	Url               string
	Password          string
	User              string
	Database          string
	BasicAuth         bool
	BasicAuthUser     string
	BasicAuthPassword string
	WithCredentials   bool
	IsDefault         bool
	JsonData          *simplejson.Json
	SecureJsonData    securejsondata.SecureJsonData
	ReadOnly          bool

	Created time.Time
	Updated time.Time
}

// DecryptedBasicAuthPassword returns data source basic auth password in plain text. It uses either deprecated
// basic_auth_password field or encrypted secure_json_data[basicAuthPassword] variable.
func (ds *DataSource) DecryptedBasicAuthPassword() string {
	return ds.decryptedValue("basicAuthPassword", ds.BasicAuthPassword)
}

// DecryptedPassword returns data source password in plain text. It uses either deprecated password field
// or encrypted secure_json_data[password] variable.
func (ds *DataSource) DecryptedPassword() string {
	return ds.decryptedValue("password", ds.Password)
}

// decryptedValue returns decrypted value from secureJsonData
func (ds *DataSource) decryptedValue(field string, fallback string) string {
	if value, ok := ds.SecureJsonData.DecryptedValue(field); ok {
		return value
	}
	return fallback
}

var knownDatasourcePlugins = map[string]bool{
	DS_ES:                                    true,
	DS_GRAPHITE:                              true,
	DS_INFLUXDB:                              true,
	DS_INFLUXDB_08:                           true,
	DS_KAIROSDB:                              true,
	DS_CLOUDWATCH:                            true,
	DS_PROMETHEUS:                            true,
	DS_OPENTSDB:                              true,
	DS_POSTGRES:                              true,
	DS_MYSQL:                                 true,
	DS_MSSQL:                                 true,
	DS_STACKDRIVER:                           true,
	DS_AZURE_MONITOR:                         true,
	DS_LOKI:                                  true,
	"opennms":                                true,
	"abhisant-druid-datasource":              true,
	"dalmatinerdb-datasource":                true,
	"gnocci":                                 true,
	"zabbix":                                 true,
	"newrelic-app":                           true,
	"grafana-datadog-datasource":             true,
	"grafana-simple-json":                    true,
	"grafana-splunk-datasource":              true,
	"udoprog-heroic-datasource":              true,
	"grafana-openfalcon-datasource":          true,
	"opennms-datasource":                     true,
	"rackerlabs-blueflood-datasource":        true,
	"crate-datasource":                       true,
	"ayoungprogrammer-finance-datasource":    true,
	"monasca-datasource":                     true,
	"vertamedia-clickhouse-datasource":       true,
	"alexanderzobnin-zabbix-datasource":      true,
	"grafana-influxdb-flux-datasource":       true,
	"doitintl-bigquery-datasource":           true,
	"grafana-azure-data-explorer-datasource": true,
}

func IsKnownDataSourcePlugin(dsType string) bool {
	_, exists := knownDatasourcePlugins[dsType]
	return exists
}

// ----------------------
// COMMANDS

// Also acts as api DTO
type AddDataSourceCommand struct {
	Name              string            `json:"name" binding:"Required"`
	Type              string            `json:"type" binding:"Required"`
	Access            DsAccess          `json:"access" binding:"Required"`
	Url               string            `json:"url"`
	Password          string            `json:"password"`
	Database          string            `json:"database"`
	User              string            `json:"user"`
	BasicAuth         bool              `json:"basicAuth"`
	BasicAuthUser     string            `json:"basicAuthUser"`
	BasicAuthPassword string            `json:"basicAuthPassword"`
	WithCredentials   bool              `json:"withCredentials"`
	IsDefault         bool              `json:"isDefault"`
	JsonData          *simplejson.Json  `json:"jsonData"`
	SecureJsonData    map[string]string `json:"secureJsonData"`
	ReadOnly          bool              `json:"readOnly"`

	OrgId int64 `json:"-"`

	Result *DataSource
}

// Also acts as api DTO
type UpdateDataSourceCommand struct {
	Name              string            `json:"name" binding:"Required"`
	Type              string            `json:"type" binding:"Required"`
	Access            DsAccess          `json:"access" binding:"Required"`
	Url               string            `json:"url"`
	Password          string            `json:"password"`
	User              string            `json:"user"`
	Database          string            `json:"database"`
	BasicAuth         bool              `json:"basicAuth"`
	BasicAuthUser     string            `json:"basicAuthUser"`
	BasicAuthPassword string            `json:"basicAuthPassword"`
	WithCredentials   bool              `json:"withCredentials"`
	IsDefault         bool              `json:"isDefault"`
	JsonData          *simplejson.Json  `json:"jsonData"`
	SecureJsonData    map[string]string `json:"secureJsonData"`
	Version           int               `json:"version"`
	ReadOnly          bool              `json:"readOnly"`

	OrgId int64 `json:"-"`
	Id    int64 `json:"-"`

	Result *DataSource
}

type DeleteDataSourceByIdCommand struct {
	Id    int64
	OrgId int64

	DeletedDatasourcesCount int64
}

type DeleteDataSourceByNameCommand struct {
	Name  string
	OrgId int64

	DeletedDatasourcesCount int64
}

// ---------------------
// QUERIES

type GetDataSourcesQuery struct {
	OrgId  int64
	User   *SignedInUser
	Result []*DataSource
}

type GetAllDataSourcesQuery struct {
	Result []*DataSource
}

type GetDataSourceByIdQuery struct {
	Id     int64
	OrgId  int64
	Result *DataSource
}

type GetDataSourceByNameQuery struct {
	Name   string
	OrgId  int64
	Result *DataSource
}

// ---------------------
//  Permissions
// ---------------------

type DsPermissionType int

const (
	DsPermissionNoAccess DsPermissionType = iota
	DsPermissionQuery
)

func (p DsPermissionType) String() string {
	names := map[int]string{
		int(DsPermissionQuery):    "Query",
		int(DsPermissionNoAccess): "No Access",
	}
	return names[int(p)]
}

type DatasourcesPermissionFilterQuery struct {
	User        *SignedInUser
	Datasources []*DataSource
	Result      []*DataSource
}
