package models

import "time"

const (
	DS_GRAPHITE      = "GRAPHITE"
	DS_INFLUXDB      = "INFLUXDB"
	DS_ES            = "ES"
	DS_ACESSS_DIRECT = "DIRECT"
	DS_ACESSS_PROXY  = "PROXY"
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
	BasicAuth bool

	Created time.Time
	Updated time.Time
}

type GetDataSourcesQuery struct {
	AccountId int64
	Resp      []*DataSource
}
