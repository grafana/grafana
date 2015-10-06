package models

import (
	"errors"
	"time"
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
	ErrDataSourceNotFound = errors.New("Data source not found")
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
	IsDefault         bool
	JsonData          map[string]interface{}

	Created time.Time
	Updated time.Time
}

func IsStandardDataSource(dsType string) bool {
	switch dsType {
	case DS_ES:
		return true
	case DS_INFLUXDB:
		return true
	case DS_OPENTSDB:
		return true
	case DS_CLOUDWATCH:
		return true
	case DS_PROMETHEUS:
		return true
	case DS_GRAPHITE:
		return true
	default:
		return false
	}
}

// ----------------------
// COMMANDS

// Also acts as api DTO
type AddDataSourceCommand struct {
	Name              string                 `json:"name" binding:"Required"`
	Type              string                 `json:"type" binding:"Required"`
	Access            DsAccess               `json:"access" binding:"Required"`
	Url               string                 `json:"url"`
	Password          string                 `json:"password"`
	Database          string                 `json:"database"`
	User              string                 `json:"user"`
	BasicAuth         bool                   `json:"basicAuth"`
	BasicAuthUser     string                 `json:"basicAuthUser"`
	BasicAuthPassword string                 `json:"basicAuthPassword"`
	IsDefault         bool                   `json:"isDefault"`
	JsonData          map[string]interface{} `json:"jsonData"`

	OrgId int64 `json:"-"`

	Result *DataSource
}

// Also acts as api DTO
type UpdateDataSourceCommand struct {
	Name              string                 `json:"name" binding:"Required"`
	Type              string                 `json:"type" binding:"Required"`
	Access            DsAccess               `json:"access" binding:"Required"`
	Url               string                 `json:"url"`
	Password          string                 `json:"password"`
	User              string                 `json:"user"`
	Database          string                 `json:"database"`
	BasicAuth         bool                   `json:"basicAuth"`
	BasicAuthUser     string                 `json:"basicAuthUser"`
	BasicAuthPassword string                 `json:"basicAuthPassword"`
	IsDefault         bool                   `json:"isDefault"`
	JsonData          map[string]interface{} `json:"jsonData"`

	OrgId int64 `json:"-"`
	Id    int64 `json:"-"`
}

type DeleteDataSourceCommand struct {
	Id    int64
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
	Result DataSource
}

type GetDataSourceByNameQuery struct {
	Name   string
	OrgId  int64
	Result DataSource
}

// ---------------------
// EVENTS
type DataSourceCreatedEvent struct {
}
