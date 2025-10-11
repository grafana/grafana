package sqleng

import (
	"database/sql"
	"regexp"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// SQLMacroEngine interface for SQL macro expansion
type SQLMacroEngine interface {
	Interpolate(query *backend.DataQuery, timeRange backend.TimeRange, sql string) (string, error)
}

// SQLMacroEngineBase provides base functionality for SQL macro engines
type SQLMacroEngineBase struct{}

func NewSQLMacroEngineBase() *SQLMacroEngineBase {
	return &SQLMacroEngineBase{}
}

func (m *SQLMacroEngineBase) ReplaceAllStringSubmatchFunc(re *regexp.Regexp, str string, repl func([]string) string) string {
	result := str
	for _, match := range re.FindAllStringSubmatch(str, -1) {
		result = strings.Replace(result, match[0], repl(match), 1)
	}
	return result
}

// SqlQueryResultTransformer interface for transforming query results
type SqlQueryResultTransformer interface {
	TransformQueryResult(columnTypes []*sql.ColumnType, rows *sql.Rows) (FrameFieldConverters, error)
	TransformQueryError(logger log.Logger, err error) error
	GetConverterList() []StringConverter
}

// FrameFieldConverters represents field converters
type FrameFieldConverters []data.FieldConverter

// StringConverter interface for string conversions
type StringConverter interface {
	ConvertString(value string) (interface{}, error)
}

type JsonData struct {
	MaxOpenConns            int    `json:"maxOpenConns"`
	MaxIdleConns            int    `json:"maxIdleConns"`
	ConnMaxLifetime         int    `json:"connMaxLifetime"`
	ConnectionTimeout       int    `json:"connectionTimeout"`
	Timezone                string `json:"timezone"`
	Database                string `json:"database"`
	SecureDSProxy           bool   `json:"enableSecureSocksProxy"`
	SecureDSProxyUsername   string `json:"secureSocksProxyUsername"`
	OracleVersion           int    `json:"oracleVersion"` // 19, 21, 23, etc.
}

type DataSourceInfo struct {
	JsonData                JsonData
	URL                     string
	User                    string
	Database                string
	ID                      int64
	Updated                 time.Time
	UID                     string
	DecryptedSecureJSONData map[string]string
}

type DataPluginConfiguration struct {
	DSInfo            DataSourceInfo
	TimeColumnNames   []string
	MetricColumnTypes []string
	RowLimit          int64
}

type DataSourceHandler struct {
	macroEngine            SQLMacroEngine
	queryResultTransformer SqlQueryResultTransformer
	db                     *sql.DB
	timeColumnNames        []string
	metricColumnTypes      []string
	log                    log.Logger
	dsInfo                 DataSourceInfo
	rowLimit               int64
	userError              string
}

type QueryJson struct {
	RawSql       string                 `json:"rawSql"`
	Format       string                 `json:"format"`
	TimeColumns  []string               `json:"timeColumns"`
	MetricColumn string                 `json:"metricColumn"`
	FillMissing  *data.FillMissing      `json:"fillMissing"`
	Interval     time.Duration          `json:"interval"`
	TimeRange    backend.TimeRange      `json:"timeRange"`
	MaxDataPoints int64                 `json:"maxDataPoints"`
	RefId        string                 `json:"refId"`
	Hide         bool                   `json:"hide"`
	Key          string                 `json:"key"`
	Datasource   *backend.DataSourceInstanceSettings `json:"datasource"`
}

// SetupFillmode configures fill mode for time series queries
func SetupFillmode(query *backend.DataQuery, interval time.Duration, fillMode string) error {
	// Implementation for fill mode setup
	return nil
}

// NewQueryDataHandler creates a new query data handler for Oracle
func NewQueryDataHandler(userFacingDefaultError string, db *sql.DB, config DataPluginConfiguration, 
	queryResultTransformer SqlQueryResultTransformer, macroEngine SQLMacroEngine, logger log.Logger) (*DataSourceHandler, error) {
	
	return &DataSourceHandler{
		macroEngine:            macroEngine,
		queryResultTransformer: queryResultTransformer,
		db:                     db,
		timeColumnNames:        config.TimeColumnNames,
		metricColumnTypes:      config.MetricColumnTypes,
		log:                    logger,
		dsInfo:                 config.DSInfo,
		rowLimit:               config.RowLimit,
		userError:              userFacingDefaultError,
	}, nil
}
