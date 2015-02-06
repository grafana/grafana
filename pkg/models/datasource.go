package models

import (
	"errors"
	"time"
)

const (
	DS_GRAPHITE      = "graphite"
	DS_INFLUXDB      = "influxdb"
	DS_ES            = "elasticsearch"
	DS_ACCESS_DIRECT = "direct"
	DS_ACCESS_PROXY  = "proxy"
)

// Typed errors
var (
	ErrDataSourceNotFound = errors.New("Data source not found")
)

type DsType string
type DsAccess string

type DataSource struct {
	Id        int64
	Version   int
	AccountId int64

	Name              string
	Type              DsType
	Access            DsAccess
	Url               string
	Password          string
	User              string
	Database          string
	BasicAuth         bool
	BasicAuthUser     string
	BasicAuthPassword string
	IsDefault         bool

	Created time.Time
	Updated time.Time
}

// ----------------------
// COMMANDS

// Also acts as api DTO
type AddDataSourceCommand struct {
	AccountId int64 `json:"-"`
	Name      string
	Type      DsType
	Access    DsAccess
	Url       string
	Password  string
	Database  string
	User      string
	IsDefault bool

	Result *DataSource
}

// Also acts as api DTO
type UpdateDataSourceCommand struct {
	Id        int64
	AccountId int64
	Name      string
	Type      DsType
	Access    DsAccess
	Url       string
	Password  string
	User      string
	Database  string
	IsDefault bool
}

type DeleteDataSourceCommand struct {
	Id        int64
	AccountId int64
}

// ---------------------
// QUERIES

type GetDataSourcesQuery struct {
	AccountId int64
	Result    []*DataSource
}

type GetDataSourceByIdQuery struct {
	Id        int64
	AccountId int64
	Result    DataSource
}

// ---------------------
// EVENTS
type DataSourceCreatedEvent struct {
}
