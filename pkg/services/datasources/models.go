package datasources

import (
	"encoding/json"
	"errors"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/user"
)

const (
	DS_ACCESS_DIRECT  = "direct"
	DS_ACCESS_PROXY   = "proxy"
	DS_ALERTMANAGER   = "alertmanager"
	DS_AZURE_MONITOR  = "grafana-azure-monitor-datasource"
	DS_DYNATRACE      = "grafana-dynatrace-datasource"
	DS_ES             = "elasticsearch"
	DS_ES_OPEN_DISTRO = "grafana-es-open-distro-datasource"
	DS_ES_OPENSEARCH  = "grafana-opensearch-datasource"
	DS_GRAPHITE       = "graphite"
	DS_INFLUXDB       = "influxdb"
	DS_INFLUXDB_08    = "influxdb_08"
	DS_JAEGER         = "jaeger"
	DS_LOKI           = "loki"
	DS_MSSQL          = "mssql"
	DS_MYSQL          = "mysql"
	DS_OPENTSDB       = "opentsdb"
	DS_POSTGRES       = "grafana-postgresql-datasource"
	DS_PROMETHEUS     = "prometheus"
	DS_TEMPO          = "tempo"
	DS_TESTDATA       = "grafana-testdata-datasource"
	DS_ZIPKIN         = "zipkin"
	// CustomHeaderName is the prefix that is used to store the name of a custom header.
	CustomHeaderName = "httpHeaderName"
	// CustomHeaderValue is the prefix that is used to store the value of a custom header.
	CustomHeaderValue = "httpHeaderValue"
)

type DsAccess string

type DataSource struct {
	ID      int64 `json:"id,omitempty" xorm:"pk autoincr 'id'"`
	OrgID   int64 `json:"orgId,omitempty" xorm:"org_id"`
	Version int   `json:"version,omitempty"`

	Name   string   `json:"name"`
	Type   string   `json:"type"`
	Access DsAccess `json:"access"`
	URL    string   `json:"url" xorm:"url"`
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
	UID               string            `json:"uid" xorm:"uid"`
	// swagger:ignore
	APIVersion string `json:"apiVersion" xorm:"api_version"`
	// swagger:ignore
	IsPrunable bool `xorm:"is_prunable"`

	Created time.Time `json:"created,omitempty"`
	Updated time.Time `json:"updated,omitempty"`

	isSecureSocksDSProxyEnabled *bool `xorm:"-"`
}

func (ds *DataSource) IsSecureSocksDSProxyEnabled() bool {
	if ds.isSecureSocksDSProxyEnabled == nil {
		enabled := ds.JsonData != nil && ds.JsonData.Get("enableSecureSocksProxy").MustBool(false)
		ds.isSecureSocksDSProxyEnabled = &enabled
	}
	return *ds.isSecureSocksDSProxyEnabled
}

type TeamHTTPHeadersJSONData struct {
	TeamHTTPHeaders TeamHTTPHeaders `json:"teamHttpHeaders"`
}

type TeamHTTPHeaders struct {
	Headers        TeamHeaders `json:"headers"`
	RestrictAccess bool        `json:"restrictAccess"`
}

type TeamHeaders map[string][]TeamHTTPHeader

type TeamHTTPHeader struct {
	Header string `json:"header"`
	Value  string `json:"value"`
}

func GetTeamHTTPHeaders(jsonData *simplejson.Json) (*TeamHTTPHeaders, error) {
	teamHTTPHeaders := &TeamHTTPHeaders{}
	if jsonData == nil {
		return nil, nil
	}
	if _, ok := jsonData.CheckGet("teamHttpHeaders"); !ok {
		return nil, nil
	}

	teamHTTPHeadersJSON, err := jsonData.Get("teamHttpHeaders").MarshalJSON()
	if err != nil {
		return nil, err
	}
	err = json.Unmarshal(teamHTTPHeadersJSON, teamHTTPHeaders)
	if err != nil {
		return nil, err
	}
	for teamID, headers := range teamHTTPHeaders.Headers {
		if teamID == "" {
			return nil, errors.New("teamID is missing or empty in teamHttpHeaders")
		}

		for _, header := range headers {
			if header.Header == "" {
				return nil, errors.New("header name is missing or empty")
			}
			if header.Value == "" {
				return nil, errors.New("header value is missing or empty")
			}
		}
	}

	return teamHTTPHeaders, nil
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
	Name            string            `json:"name"`
	Type            string            `json:"type" binding:"Required"`
	Access          DsAccess          `json:"access" binding:"Required"`
	URL             string            `json:"url"`
	Database        string            `json:"database"`
	User            string            `json:"user"`
	BasicAuth       bool              `json:"basicAuth"`
	BasicAuthUser   string            `json:"basicAuthUser"`
	WithCredentials bool              `json:"withCredentials"`
	IsDefault       bool              `json:"isDefault"`
	JsonData        *simplejson.Json  `json:"jsonData"`
	SecureJsonData  map[string]string `json:"secureJsonData"`
	UID             string            `json:"uid"`
	// swagger:ignore
	APIVersion string `json:"apiVersion"`
	// swagger:ignore
	IsPrunable bool

	OrgID                   int64             `json:"-"`
	UserID                  int64             `json:"-"`
	ReadOnly                bool              `json:"-"`
	EncryptedSecureJsonData map[string][]byte `json:"-"`
	UpdateSecretFn          UpdateSecretFn    `json:"-"`
}

// Also acts as api DTO
type UpdateDataSourceCommand struct {
	Name            string            `json:"name" binding:"Required"`
	Type            string            `json:"type" binding:"Required"`
	Access          DsAccess          `json:"access" binding:"Required"`
	URL             string            `json:"url"`
	User            string            `json:"user"`
	Database        string            `json:"database"`
	BasicAuth       bool              `json:"basicAuth"`
	BasicAuthUser   string            `json:"basicAuthUser"`
	WithCredentials bool              `json:"withCredentials"`
	IsDefault       bool              `json:"isDefault"`
	JsonData        *simplejson.Json  `json:"jsonData"`
	SecureJsonData  map[string]string `json:"secureJsonData"`
	Version         int               `json:"version"`
	UID             string            `json:"uid"`
	// swagger:ignore
	APIVersion string `json:"apiVersion"`
	// swagger:ignore
	IsPrunable bool

	OrgID                   int64             `json:"-"`
	ID                      int64             `json:"-"`
	ReadOnly                bool              `json:"-"`
	EncryptedSecureJsonData map[string][]byte `json:"-"`
	UpdateSecretFn          UpdateSecretFn    `json:"-"`
	IgnoreOldSecureJsonData bool              `json:"-"`

	AllowLBACRuleUpdates bool `json:"-"`
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

	// Optional way to skip publishing delete event for data sources that are
	// deleted just to be re-created with the same UID during provisioning.
	// In such case we don't want to publish the event that triggers clean-up
	// of related resources (like correlations)
	SkipPublish bool
}

// Function for updating secrets along with datasources, to ensure atomicity
type UpdateSecretFn func() error

// ---------------------
// QUERIES

type GetDataSourcesQuery struct {
	OrgID           int64
	DataSourceLimit int
	User            *user.SignedInUser
}

type GetAllDataSourcesQuery struct{}

type GetDataSourcesByTypeQuery struct {
	OrgID    int64 // optional: filter by org_id
	Type     string
	AliasIDs []string
}

// GetDataSourceQuery will get a DataSource based on OrgID as well as the UID (preferred), ID, or Name.
// At least one of the UID, ID, or Name properties must be set in addition to OrgID.
type GetDataSourceQuery struct {
	ID   int64
	UID  string
	Name string

	OrgID int64
}

type DatasourcesPermissionFilterQuery struct {
	User        *user.SignedInUser
	Datasources []*DataSource
}

const (
	QuotaTargetSrv quota.TargetSrv = "data_source"
	QuotaTarget    quota.Target    = "data_source"
)
