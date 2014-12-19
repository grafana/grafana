package models

import (
	"errors"
	"time"
)

const (
	DS_GRAPHITE      = "graphite"
	DS_INFLUXDB      = "influxdb"
	DS_ES            = "es"
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
	AccountId int64

	Name      string
	Type      DsType
	Access    DsAccess
	Url       string
	Password  string
	User      string
	Database  string
	BasicAuth bool

	Created time.Time
	Updated time.Time
}

type GetDataSourcesQuery struct {
	AccountId int64
	Result    []*DataSource
}

type GetDataSourceByIdQuery struct {
	Id        int64
	AccountId int64
	Result    DataSource
}

type AddDataSourceCommand struct {
	AccountId int64
	Name      string
	Type      DsType
	Access    DsAccess
	Url       string
	Password  string
	Database  string
	User      string
}

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
}

type DeleteDataSourceCommand struct {
	Id        int64
	AccountId int64
}
