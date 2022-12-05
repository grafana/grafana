package datasources

import (
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/user"
)

const (
	DS_GRAPHITE       = "graphite"
	DS_INFLUXDB       = "influxdb"
	DS_INFLUXDB_08    = "influxdb_08"
	DS_ES             = "elasticsearch"
	DS_PROMETHEUS     = "prometheus"
	DS_ALERTMANAGER   = "alertmanager"
	DS_JAEGER         = "jaeger"
	DS_LOKI           = "loki"
	DS_OPENTSDB       = "opentsdb"
	DS_TEMPO          = "tempo"
	DS_ZIPKIN         = "zipkin"
	DS_MYSQL          = "mysql"
	DS_POSTGRES       = "postgres"
	DS_MSSQL          = "mssql"
	DS_ACCESS_DIRECT  = "direct"
	DS_ACCESS_PROXY   = "proxy"
	DS_ES_OPEN_DISTRO = "grafana-es-open-distro-datasource"
	DS_ES_OPENSEARCH  = "grafana-opensearch-datasource"
)

type DsAccess string

type DataSource struct {
	Id      int64 `json:"id,omitempty"`
	OrgId   int64 `json:"orgId,omitempty"`
	Version int   `json:"version,omitempty"`

	Name   string   `json:"name"`
	Type   string   `json:"type"`
	Access DsAccess `json:"access"`
	Url    string   `json:"url"`
	// swagger:ignore
	Password      string `json:"-"`
	User          string `json:"user"`
	Database      string `json:"database"`
	BasicAuth     bool   `json:"basicAuth"`
	BasicAuthUser string `json:"basicAuthUser"`
	// swagger:ignore
	BasicAuthPassword string            `json:"-"`
	WithCredentials   bool              `json:"withCredentials"`
	IsDefault         bool              `json:"isDefault"`
	JsonData          *simplejson.Json  `json:"jsonData"`
	SecureJsonData    map[string][]byte `json:"secureJsonData"`
	ReadOnly          bool              `json:"readOnly"`
	Uid               string            `json:"uid"`

	Created time.Time `json:"created,omitempty"`
	Updated time.Time `json:"updated,omitempty"`
}

// AllowedCookies parses the jsondata.keepCookies and returns a list of
// allowed cookies, otherwise an empty list.
func (ds DataSource) AllowedCookies() []string {
	if ds.JsonData != nil {
		if keepCookies := ds.JsonData.Get("keepCookies"); keepCookies != nil {
			return keepCookies.MustStringArray()
		}
	}

	return []string{}
}

// Specific error type for grpc secrets management so that we can show more detailed plugin errors to users
type ErrDatasourceSecretsPluginUserFriendly struct {
	Err string
}

func (e ErrDatasourceSecretsPluginUserFriendly) Error() string {
	return e.Err
}

// ----------------------
// COMMANDS

// Also acts as api DTO
type AddDataSourceCommand struct {
	Name            string            `json:"name" binding:"Required"`
	Type            string            `json:"type" binding:"Required"`
	Access          DsAccess          `json:"access" binding:"Required"`
	Url             string            `json:"url"`
	Database        string            `json:"database"`
	User            string            `json:"user"`
	BasicAuth       bool              `json:"basicAuth"`
	BasicAuthUser   string            `json:"basicAuthUser"`
	WithCredentials bool              `json:"withCredentials"`
	IsDefault       bool              `json:"isDefault"`
	JsonData        *simplejson.Json  `json:"jsonData"`
	SecureJsonData  map[string]string `json:"secureJsonData"`
	Uid             string            `json:"uid"`

	OrgId                   int64             `json:"-"`
	UserId                  int64             `json:"-"`
	ReadOnly                bool              `json:"-"`
	EncryptedSecureJsonData map[string][]byte `json:"-"`
	UpdateSecretFn          UpdateSecretFn    `json:"-"`

	Result *DataSource `json:"-"`
}

// Also acts as api DTO
type UpdateDataSourceCommand struct {
	Name            string            `json:"name" binding:"Required"`
	Type            string            `json:"type" binding:"Required"`
	Access          DsAccess          `json:"access" binding:"Required"`
	Url             string            `json:"url"`
	User            string            `json:"user"`
	Database        string            `json:"database"`
	BasicAuth       bool              `json:"basicAuth"`
	BasicAuthUser   string            `json:"basicAuthUser"`
	WithCredentials bool              `json:"withCredentials"`
	IsDefault       bool              `json:"isDefault"`
	JsonData        *simplejson.Json  `json:"jsonData"`
	SecureJsonData  map[string]string `json:"secureJsonData"`
	Version         int               `json:"version"`
	Uid             string            `json:"uid"`

	OrgId                   int64             `json:"-"`
	Id                      int64             `json:"-"`
	ReadOnly                bool              `json:"-"`
	EncryptedSecureJsonData map[string][]byte `json:"-"`
	UpdateSecretFn          UpdateSecretFn    `json:"-"`

	Result *DataSource `json:"-"`
}

// DeleteDataSourceCommand will delete a DataSource based on OrgID as well as the UID (preferred), ID, or Name.
// At least one of the UID, ID, or Name properties must be set in addition to OrgID.
type DeleteDataSourceCommand struct {
	ID   int64
	UID  string
	Name string

	OrgID int64

	DeletedDatasourcesCount int64

	UpdateSecretFn UpdateSecretFn
}

// Function for updating secrets along with datasources, to ensure atomicity
type UpdateSecretFn func() error

// ---------------------
// QUERIES

type GetDataSourcesQuery struct {
	OrgId           int64
	DataSourceLimit int
	User            *user.SignedInUser
	Result          []*DataSource
}

type GetAllDataSourcesQuery struct {
	Result []*DataSource
}

type GetDataSourcesByTypeQuery struct {
	OrgId  int64 // optional: filter by org_id
	Type   string
	Result []*DataSource
}

type GetDefaultDataSourceQuery struct {
	OrgId  int64
	User   *user.SignedInUser
	Result *DataSource
}

// GetDataSourceQuery will get a DataSource based on OrgID as well as the UID (preferred), ID, or Name.
// At least one of the UID, ID, or Name properties must be set in addition to OrgID.
type GetDataSourceQuery struct {
	Id   int64
	Uid  string
	Name string

	OrgId int64

	Result *DataSource
}

type DatasourcesPermissionFilterQuery struct {
	User        *user.SignedInUser
	Datasources []*DataSource
	Result      []*DataSource
}

const (
	QuotaTargetSrv quota.TargetSrv = "data_source"
	QuotaTarget    quota.Target    = "data_source"
)
