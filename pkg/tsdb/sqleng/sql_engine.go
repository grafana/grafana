package sqleng

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"regexp"
	"sync"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/data/sqlutil"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/interval"
	"xorm.io/xorm"
)

// MetaKeyExecutedQueryString is the key where the executed query should get stored
const MetaKeyExecutedQueryString = "executedQueryString"

var ErrConnectionFailed = errors.New("failed to connect to server - please inspect Grafana server log for details")

// SQLMacroEngine interpolates macros into sql. It takes in the Query to have access to query context and
// timeRange to be able to generate queries that use from and to.
type SQLMacroEngine interface {
	Interpolate(query backend.DataQuery, timeRange backend.TimeRange, sql string) (string, error)
}

// SqlQueryResultTransformer transforms a query result row to RowValues with proper types.
type SqlQueryResultTransformer interface {
	// TransformQueryError transforms a query error.
	TransformQueryError(err error) error
	GetConverterList() []sqlutil.StringConverter
}

type engineCacheType struct {
	cache   map[int64]*xorm.Engine
	updates map[int64]time.Time
	sync.Mutex
}

var engineCache = engineCacheType{
	cache:   make(map[int64]*xorm.Engine),
	updates: make(map[int64]time.Time),
}

var sqlIntervalCalculator = interval.NewCalculator()

// NewXormEngine is an xorm.Engine factory, that can be stubbed by tests.
//nolint:gocritic
var NewXormEngine = func(driverName string, connectionString string) (*xorm.Engine, error) {
	return xorm.NewEngine(driverName, connectionString)
}

type dataSourceInfo struct {
	macroEngine            SQLMacroEngine
	queryResultTransformer SqlQueryResultTransformer
	engine                 *xorm.Engine
	timeColumnNames        []string
	metricColumnTypes      []string
	log                    log.Logger
	cfg                    *setting.Cfg
	im                     instancemgmt.InstanceManager
}

type DataPluginConfiguration struct {
	DriverName        string
	Datasource        *backend.DataSourceInstanceSettings
	ConnectionString  string
	TimeColumnNames   []string
	MetricColumnTypes []string
}

func (e *dataSourceInfo) transformQueryError(err error) error {
	// OpError is the error type usually returned by functions in the net
	// package. It describes the operation, network type, and address of
	// an error. We log this error rather than return it to the client
	// for security purposes.
	var opErr *net.OpError
	if errors.As(err, &opErr) {
		e.log.Error("query error", "err", err)
		return ErrConnectionFailed
	}

	return e.queryResultTransformer.TransformQueryError(err)
}

func NewQueryDataHandler(config DataPluginConfiguration, queryResultTransformer SqlQueryResultTransformer,
	macroEngine SQLMacroEngine, log log.Logger) (backend.QueryDataHandler, error) {
	dsInfo := dataSourceInfo{
		queryResultTransformer: queryResultTransformer,
		macroEngine:            macroEngine,
		timeColumnNames:        []string{"time"},
		log:                    log,
	}

	if len(config.TimeColumnNames) > 0 {
		dsInfo.timeColumnNames = config.TimeColumnNames
	}

	if len(config.MetricColumnTypes) > 0 {
		dsInfo.metricColumnTypes = config.MetricColumnTypes
	}

	engineCache.Lock()
	defer engineCache.Unlock()

	if engine, present := engineCache.cache[config.Datasource.ID]; present {
		if updateTime := engineCache.updates[config.Datasource.ID]; updateTime.Before(config.Datasource.Updated) {
			dsInfo.engine = engine
			return &dsInfo, nil
		}
	}

	engine, err := NewXormEngine(config.DriverName, config.ConnectionString)
	if err != nil {
		return nil, err
	}

	type JsonData struct {
		maxOpenConns    int `json:"maxOpenConns"`
		maxIdleConns    int `json:"maxIdleConns"`
		connMaxLifetime int `json:"connMaxLifetime"`
	}
	jsonData := JsonData{maxOpenConns: 0, maxIdleConns: 2, connMaxLifetime: 14400}
	err = json.Unmarshal(config.Datasource.JSONData, &jsonData)
	if err != nil {
		return nil, fmt.Errorf("error reading settings: %w", err)
	}

	engine.SetMaxOpenConns(jsonData.maxOpenConns)
	engine.SetMaxIdleConns(jsonData.maxIdleConns)
	engine.SetConnMaxLifetime(time.Duration(jsonData.connMaxLifetime) * time.Second)

	engineCache.updates[config.Datasource.ID] = config.Datasource.Updated
	engineCache.cache[config.Datasource.ID] = engine
	dsInfo.engine = engine

	return &dsInfo, nil
}

const rowLimit = 1000000

func (e *dataSourceInfo) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	result := backend.NewQueryDataResponse()
	ch := make(chan backend.DataResponse, len(queryContext.Queries))
	var wg sync.WaitGroup
	// Execute each query in a goroutine and wait for them to finish afterwards
	for _, query := range queryContext.Queries {
		if query.Model.Get("rawSql").MustString() == "" {
			continue
		}

		wg.Add(1)
		go e.executeQuery(query, &wg, queryContext, ch)
	}

	wg.Wait()

	// Read results from channels
	close(ch)
	result.Responses = make(map[string]backend.DataResponse)
	for queryResult := range ch {
		result.Responses[queryContext.RefID] = queryResult
	}

	return result, nil
}

type SQLMacroEngineBase struct{}

func NewSQLMacroEngineBase() *SQLMacroEngineBase {
	return &SQLMacroEngineBase{}
}

func (m *SQLMacroEngineBase) ReplaceAllStringSubmatchFunc(re *regexp.Regexp, str string, repl func([]string) string) string {
	result := ""
	lastIndex := 0

	for _, v := range re.FindAllSubmatchIndex([]byte(str), -1) {
		groups := []string{}
		for i := 0; i < len(v); i += 2 {
			groups = append(groups, str[v[i]:v[i+1]])
		}

		result += str[lastIndex:v[0]] + repl(groups)
		lastIndex = v[1]
	}

	return result + str[lastIndex:]
}
