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
	DS_ACCESS_DIRECT = "direct"
	DS_ACCESS_PROXY  = "proxy"
)

// Typed errors
var (
	ErrDataSourceNotFound   = errors.New("Data source not found")
	ErrDataSourceNameExists = errors.New("Data source with same name already exists")
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

	Created time.Time
	Updated time.Time
}

var knownDatasourcePlugins map[string]bool = map[string]bool{
	DS_ES:          true,
	DS_GRAPHITE:    true,
	DS_INFLUXDB:    true,
	DS_INFLUXDB_08: true,
	DS_KAIROSDB:    true,
	DS_CLOUDWATCH:  true,
	DS_PROMETHEUS:  true,
	DS_OPENTSDB:    true,
	"opennms":      true,
	"druid":        true,
	"dalmatinerdb": true,
	"gnocci":       true,
	"zabbix":       true,
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

	OrgId   int64 `json:"-"`
	Id      int64 `json:"-"`
	Version int   `json:"-"`
}

type DeleteDataSourceByIdCommand struct {
	Id    int64
	OrgId int64
}

type DeleteDataSourceByNameCommand struct {
	Name  string
	OrgId int64
}

// ---------------------
// QUERIES

type GetDataSourcesQuery struct {
	OrgId  int64
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
// EVENTS
type DataSourceCreatedEvent struct {
}
