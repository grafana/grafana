package sqleng

import (
	"container/list"
	"context"
	"database/sql"
	"errors"
	"fmt"
	"math"
	"net"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/interval"

	"github.com/grafana/grafana/pkg/infra/log"

	"github.com/grafana/grafana/pkg/components/null"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"xorm.io/core"
	"xorm.io/xorm"
)

// MetaKeyExecutedQueryString is the key where the executed query should get stored
const MetaKeyExecutedQueryString = "executedQueryString"

var ErrConnectionFailed = errors.New("failed to connect to server - please inspect Grafana server log for details")

// SQLMacroEngine interpolates macros into sql. It takes in the Query to have access to query context and
// timeRange to be able to generate queries that use from and to.
type SQLMacroEngine interface {
	Interpolate(query plugins.DataSubQuery, timeRange plugins.DataTimeRange, sql string) (string, error)
}

// SqlQueryResultTransformer transforms a query result row to RowValues with proper types.
type SqlQueryResultTransformer interface {
	// TransformQueryResult transforms a query result row to RowValues with proper types.
	TransformQueryResult(columnTypes []*sql.ColumnType, rows *core.Rows) (plugins.DataRowValues, error)
	// TransformQueryError transforms a query error.
	TransformQueryError(err error) error
}

type engineCacheType struct {
	cache    map[int64]*xorm.Engine
	versions map[int64]int
	sync.Mutex
}

var engineCache = engineCacheType{
	cache:    make(map[int64]*xorm.Engine),
	versions: make(map[int64]int),
}

var sqlIntervalCalculator = interval.NewCalculator()

// NewXormEngine is an xorm.Engine factory, that can be stubbed by tests.
//nolint:gocritic
var NewXormEngine = func(driverName string, connectionString string) (*xorm.Engine, error) {
	return xorm.NewEngine(driverName, connectionString)
}

const timeEndColumnName = "timeend"

type dataPlugin struct {
	macroEngine            SQLMacroEngine
	queryResultTransformer SqlQueryResultTransformer
	engine                 *xorm.Engine
	timeColumnNames        []string
	metricColumnTypes      []string
	log                    log.Logger
}

type DataPluginConfiguration struct {
	DriverName        string
	Datasource        *models.DataSource
	ConnectionString  string
	TimeColumnNames   []string
	MetricColumnTypes []string
}

// NewDataPlugin returns a new plugins.DataPlugin
func NewDataPlugin(config DataPluginConfiguration, queryResultTransformer SqlQueryResultTransformer,
	macroEngine SQLMacroEngine, log log.Logger) (plugins.DataPlugin, error) {
	plugin := dataPlugin{
		queryResultTransformer: queryResultTransformer,
		macroEngine:            macroEngine,
		timeColumnNames:        []string{"time"},
		log:                    log,
	}

	if len(config.TimeColumnNames) > 0 {
		plugin.timeColumnNames = config.TimeColumnNames
	}

	if len(config.MetricColumnTypes) > 0 {
		plugin.metricColumnTypes = config.MetricColumnTypes
	}

	engineCache.Lock()
	defer engineCache.Unlock()

	if engine, present := engineCache.cache[config.Datasource.Id]; present {
		if version := engineCache.versions[config.Datasource.Id]; version == config.Datasource.Version {
			plugin.engine = engine
			return &plugin, nil
		}
	}

	engine, err := NewXormEngine(config.DriverName, config.ConnectionString)
	if err != nil {
		return nil, err
	}

	maxOpenConns := config.Datasource.JsonData.Get("maxOpenConns").MustInt(0)
	engine.SetMaxOpenConns(maxOpenConns)
	maxIdleConns := config.Datasource.JsonData.Get("maxIdleConns").MustInt(2)
	engine.SetMaxIdleConns(maxIdleConns)
	connMaxLifetime := config.Datasource.JsonData.Get("connMaxLifetime").MustInt(14400)
	engine.SetConnMaxLifetime(time.Duration(connMaxLifetime) * time.Second)

	engineCache.versions[config.Datasource.Id] = config.Datasource.Version
	engineCache.cache[config.Datasource.Id] = engine
	plugin.engine = engine

	return &plugin, nil
}

const rowLimit = 1000000

// Query is the main function for the SqlQueryEndpoint
func (e *dataPlugin) DataQuery(ctx context.Context, dsInfo *models.DataSource,
	queryContext plugins.DataQuery) (plugins.DataResponse, error) {
	var timeRange plugins.DataTimeRange
	if queryContext.TimeRange != nil {
		timeRange = *queryContext.TimeRange
	}
	ch := make(chan plugins.DataQueryResult, len(queryContext.Queries))
	var wg sync.WaitGroup
	// Execute each query in a goroutine and wait for them to finish afterwards
	for _, query := range queryContext.Queries {
		if query.Model.Get("rawSql").MustString() == "" {
			continue
		}

		wg.Add(1)

		go func(query plugins.DataSubQuery) {
			defer wg.Done()

			queryResult := plugins.DataQueryResult{
				Meta:  simplejson.New(),
				RefID: query.RefID,
			}

			rawSQL := query.Model.Get("rawSql").MustString()
			if rawSQL == "" {
				panic("Query model property rawSql should not be empty at this point")
			}

			// global substitutions
			rawSQL, err := Interpolate(query, timeRange, rawSQL)
			if err != nil {
				queryResult.Error = err
				ch <- queryResult
				return
			}

			// datasource specific substitutions
			rawSQL, err = e.macroEngine.Interpolate(query, timeRange, rawSQL)
			if err != nil {
				queryResult.Error = err
				ch <- queryResult
				return
			}

			queryResult.Meta.Set(MetaKeyExecutedQueryString, rawSQL)

			session := e.engine.NewSession()
			defer session.Close()
			db := session.DB()

			rows, err := db.Query(rawSQL)
			if err != nil {
				queryResult.Error = e.transformQueryError(err)
				ch <- queryResult
				return
			}
			defer func() {
				if err := rows.Close(); err != nil {
					e.log.Warn("Failed to close rows", "err", err)
				}
			}()

			format := query.Model.Get("format").MustString("time_series")

			switch format {
			case "time_series":
				err := e.transformToTimeSeries(query, rows, &queryResult, queryContext)
				if err != nil {
					queryResult.Error = err
					ch <- queryResult
					return
				}
			case "table":
				err := e.transformToTable(query, rows, &queryResult, queryContext)
				if err != nil {
					queryResult.Error = err
					ch <- queryResult
					return
				}
			}

			ch <- queryResult
		}(query)
	}

	wg.Wait()

	// Read results from channels
	close(ch)
	result := plugins.DataResponse{
		Results: make(map[string]plugins.DataQueryResult),
	}
	for queryResult := range ch {
		result.Results[queryResult.RefID] = queryResult
	}

	return result, nil
}

// Interpolate provides global macros/substitutions for all sql datasources.
var Interpolate = func(query plugins.DataSubQuery, timeRange plugins.DataTimeRange, sql string) (string, error) {
	minInterval, err := interval.GetIntervalFrom(query.DataSource, query.Model, time.Second*60)
	if err != nil {
		return sql, nil
	}
	interval := sqlIntervalCalculator.Calculate(timeRange, minInterval)

	sql = strings.ReplaceAll(sql, "$__interval_ms", strconv.FormatInt(interval.Milliseconds(), 10))
	sql = strings.ReplaceAll(sql, "$__interval", interval.Text)
	sql = strings.ReplaceAll(sql, "$__unixEpochFrom()", fmt.Sprintf("%d", timeRange.GetFromAsSecondsEpoch()))
	sql = strings.ReplaceAll(sql, "$__unixEpochTo()", fmt.Sprintf("%d", timeRange.GetToAsSecondsEpoch()))

	return sql, nil
}

func (e *dataPlugin) transformToTable(query plugins.DataSubQuery, rows *core.Rows,
	result *plugins.DataQueryResult, queryContext plugins.DataQuery) error {
	columnNames, err := rows.Columns()
	if err != nil {
		return err
	}

	columnCount := len(columnNames)

	rowCount := 0
	timeIndex := -1
	timeEndIndex := -1

	table := plugins.DataTable{
		Columns: make([]plugins.DataTableColumn, columnCount),
		Rows:    make([]plugins.DataRowValues, 0),
	}

	for i, name := range columnNames {
		table.Columns[i].Text = name

		for _, tc := range e.timeColumnNames {
			if name == tc {
				timeIndex = i
				break
			}

			if timeIndex >= 0 && name == timeEndColumnName {
				timeEndIndex = i
				break
			}
		}
	}

	columnTypes, err := rows.ColumnTypes()
	if err != nil {
		return err
	}

	for ; rows.Next(); rowCount++ {
		if rowCount > rowLimit {
			return fmt.Errorf("query row limit exceeded, limit %d", rowLimit)
		}

		values, err := e.queryResultTransformer.TransformQueryResult(columnTypes, rows)
		if err != nil {
			return err
		}

		// converts column named time and timeend to unix timestamp in milliseconds
		// to make native mssql datetime types and epoch dates work in
		// annotation and table queries.
		ConvertSqlTimeColumnToEpochMs(values, timeIndex)
		ConvertSqlTimeColumnToEpochMs(values, timeEndIndex)
		table.Rows = append(table.Rows, values)
	}

	result.Tables = append(result.Tables, table)
	result.Meta.Set("rowCount", rowCount)
	return nil
}

func newProcessCfg(query plugins.DataSubQuery, queryContext plugins.DataQuery, rows *core.Rows) (*processCfg, error) {
	columnNames, err := rows.Columns()
	if err != nil {
		return nil, err
	}
	columnTypes, err := rows.ColumnTypes()
	if err != nil {
		return nil, err
	}

	fillMissing := query.Model.Get("fill").MustBool(false)

	cfg := &processCfg{
		rowCount:           0,
		columnTypes:        columnTypes,
		columnNames:        columnNames,
		rows:               rows,
		timeIndex:          -1,
		metricIndex:        -1,
		metricPrefix:       false,
		fillMissing:        fillMissing,
		seriesByQueryOrder: list.New(),
		pointsBySeries:     make(map[string]*plugins.DataTimeSeries),
		queryContext:       queryContext,
	}
	return cfg, nil
}

func (e *dataPlugin) transformToTimeSeries(query plugins.DataSubQuery, rows *core.Rows,
	result *plugins.DataQueryResult, queryContext plugins.DataQuery) error {
	cfg, err := newProcessCfg(query, queryContext, rows)
	if err != nil {
		return err
	}

	// check columns of resultset: a column named time is mandatory
	// the first text column is treated as metric name unless a column named metric is present
	for i, col := range cfg.columnNames {
		for _, tc := range e.timeColumnNames {
			if col == tc {
				cfg.timeIndex = i
				continue
			}
		}
		switch col {
		case "metric":
			cfg.metricIndex = i
		default:
			if cfg.metricIndex == -1 {
				columnType := cfg.columnTypes[i].DatabaseTypeName()

				for _, mct := range e.metricColumnTypes {
					if columnType == mct {
						cfg.metricIndex = i
						continue
					}
				}
			}
		}
	}

	// use metric column as prefix with multiple value columns
	if cfg.metricIndex != -1 && len(cfg.columnNames) > 3 {
		cfg.metricPrefix = true
	}

	if cfg.timeIndex == -1 {
		return fmt.Errorf("found no column named %q", strings.Join(e.timeColumnNames, " or "))
	}

	if cfg.fillMissing {
		cfg.fillInterval = query.Model.Get("fillInterval").MustFloat64() * 1000
		switch query.Model.Get("fillMode").MustString() {
		case "null":
		case "previous":
			cfg.fillPrevious = true
		case "value":
			cfg.fillValue.Float64 = query.Model.Get("fillValue").MustFloat64()
			cfg.fillValue.Valid = true
		}
	}

	for rows.Next() {
		if err := e.processRow(cfg); err != nil {
			return err
		}
	}

	for elem := cfg.seriesByQueryOrder.Front(); elem != nil; elem = elem.Next() {
		key := elem.Value.(string)
		if !cfg.fillMissing {
			result.Series = append(result.Series, *cfg.pointsBySeries[key])
			continue
		}

		series := cfg.pointsBySeries[key]
		// fill in values from last fetched value till interval end
		intervalStart := series.Points[len(series.Points)-1][1].Float64
		intervalEnd := float64(queryContext.TimeRange.MustGetTo().UnixNano() / 1e6)

		if cfg.fillPrevious {
			if len(series.Points) > 0 {
				cfg.fillValue = series.Points[len(series.Points)-1][0]
			} else {
				cfg.fillValue.Valid = false
			}
		}

		// align interval start
		intervalStart = math.Floor(intervalStart/cfg.fillInterval) * cfg.fillInterval
		for i := intervalStart + cfg.fillInterval; i < intervalEnd; i += cfg.fillInterval {
			series.Points = append(series.Points, plugins.DataTimePoint{cfg.fillValue, null.FloatFrom(i)})
			cfg.rowCount++
		}

		result.Series = append(result.Series, *series)
	}

	result.Meta.Set("rowCount", cfg.rowCount)
	return nil
}

func (e *dataPlugin) transformQueryError(err error) error {
	// OpError is the error type usually returned by functions in the net
	// package. It describes the operation, network type, and address of
	// an error. We log this error rather than returing it to the client
	// for security purposes.
	var opErr *net.OpError
	if errors.As(err, &opErr) {
		e.log.Error("query error", "err", err)
		return ErrConnectionFailed
	}

	return e.queryResultTransformer.TransformQueryError(err)
}

type processCfg struct {
	rowCount           int
	columnTypes        []*sql.ColumnType
	columnNames        []string
	rows               *core.Rows
	timeIndex          int
	metricIndex        int
	metricPrefix       bool
	metricPrefixValue  string
	fillMissing        bool
	pointsBySeries     map[string]*plugins.DataTimeSeries
	seriesByQueryOrder *list.List
	fillValue          null.Float
	queryContext       plugins.DataQuery
	fillInterval       float64
	fillPrevious       bool
}

func (e *dataPlugin) processRow(cfg *processCfg) error {
	var timestamp float64
	var value null.Float
	var metric string

	if cfg.rowCount > rowLimit {
		return fmt.Errorf("query row limit exceeded, limit %d", rowLimit)
	}

	values, err := e.queryResultTransformer.TransformQueryResult(cfg.columnTypes, cfg.rows)
	if err != nil {
		return err
	}

	// converts column named time to unix timestamp in milliseconds to make
	// native mysql datetime types and epoch dates work in
	// annotation and table queries.
	ConvertSqlTimeColumnToEpochMs(values, cfg.timeIndex)

	switch columnValue := values[cfg.timeIndex].(type) {
	case int64:
		timestamp = float64(columnValue)
	case float64:
		timestamp = columnValue
	default:
		return fmt.Errorf("invalid type for column time, must be of type timestamp or unix timestamp, got: %T %v",
			columnValue, columnValue)
	}

	if cfg.metricIndex >= 0 {
		columnValue, ok := values[cfg.metricIndex].(string)
		if !ok {
			return fmt.Errorf("column metric must be of type %s. metric column name: %s type: %s but datatype is %T",
				strings.Join(e.metricColumnTypes, ", "), cfg.columnNames[cfg.metricIndex],
				cfg.columnTypes[cfg.metricIndex].DatabaseTypeName(), values[cfg.metricIndex])
		}

		if cfg.metricPrefix {
			cfg.metricPrefixValue = columnValue
		} else {
			metric = columnValue
		}
	}

	for i, col := range cfg.columnNames {
		if i == cfg.timeIndex || i == cfg.metricIndex {
			continue
		}

		if value, err = ConvertSqlValueColumnToFloat(col, values[i]); err != nil {
			return err
		}

		if cfg.metricIndex == -1 {
			metric = col
		} else if cfg.metricPrefix {
			metric = cfg.metricPrefixValue + " " + col
		}

		series, exists := cfg.pointsBySeries[metric]
		if !exists {
			series = &plugins.DataTimeSeries{Name: metric}
			cfg.pointsBySeries[metric] = series
			cfg.seriesByQueryOrder.PushBack(metric)
		}

		if cfg.fillMissing {
			var intervalStart float64
			if !exists {
				intervalStart = float64(cfg.queryContext.TimeRange.MustGetFrom().UnixNano() / 1e6)
			} else {
				intervalStart = series.Points[len(series.Points)-1][1].Float64 + cfg.fillInterval
			}

			if cfg.fillPrevious {
				if len(series.Points) > 0 {
					cfg.fillValue = series.Points[len(series.Points)-1][0]
				} else {
					cfg.fillValue.Valid = false
				}
			}

			// align interval start
			intervalStart = math.Floor(intervalStart/cfg.fillInterval) * cfg.fillInterval

			for i := intervalStart; i < timestamp; i += cfg.fillInterval {
				series.Points = append(series.Points, plugins.DataTimePoint{cfg.fillValue, null.FloatFrom(i)})
				cfg.rowCount++
			}
		}

		series.Points = append(series.Points, plugins.DataTimePoint{value, null.FloatFrom(timestamp)})
		cfg.pointsBySeries[metric] = series

		// TODO: Make non-global
		if setting.Env == setting.Dev {
			e.log.Debug("Rows", "metric", metric, "time", timestamp, "value", value)
		}
	}

	return nil
}

// ConvertSqlTimeColumnToEpochMs converts column named time to unix timestamp in milliseconds
// to make native datetime types and epoch dates work in annotation and table queries.
func ConvertSqlTimeColumnToEpochMs(values plugins.DataRowValues, timeIndex int) {
	if timeIndex >= 0 {
		switch value := values[timeIndex].(type) {
		case time.Time:
			values[timeIndex] = float64(value.UnixNano()) / float64(time.Millisecond)
		case *time.Time:
			if value != nil {
				values[timeIndex] = float64(value.UnixNano()) / float64(time.Millisecond)
			}
		case int64:
			values[timeIndex] = int64(epochPrecisionToMS(float64(value)))
		case *int64:
			if value != nil {
				values[timeIndex] = int64(epochPrecisionToMS(float64(*value)))
			}
		case uint64:
			values[timeIndex] = int64(epochPrecisionToMS(float64(value)))
		case *uint64:
			if value != nil {
				values[timeIndex] = int64(epochPrecisionToMS(float64(*value)))
			}
		case int32:
			values[timeIndex] = int64(epochPrecisionToMS(float64(value)))
		case *int32:
			if value != nil {
				values[timeIndex] = int64(epochPrecisionToMS(float64(*value)))
			}
		case uint32:
			values[timeIndex] = int64(epochPrecisionToMS(float64(value)))
		case *uint32:
			if value != nil {
				values[timeIndex] = int64(epochPrecisionToMS(float64(*value)))
			}
		case float64:
			values[timeIndex] = epochPrecisionToMS(value)
		case *float64:
			if value != nil {
				values[timeIndex] = epochPrecisionToMS(*value)
			}
		case float32:
			values[timeIndex] = epochPrecisionToMS(float64(value))
		case *float32:
			if value != nil {
				values[timeIndex] = epochPrecisionToMS(float64(*value))
			}
		}
	}
}

// ConvertSqlValueColumnToFloat converts timeseries value column to float.
//nolint: gocyclo
func ConvertSqlValueColumnToFloat(columnName string, columnValue interface{}) (null.Float, error) {
	var value null.Float

	switch typedValue := columnValue.(type) {
	case int:
		value = null.FloatFrom(float64(typedValue))
	case *int:
		if typedValue == nil {
			value.Valid = false
		} else {
			value = null.FloatFrom(float64(*typedValue))
		}
	case int64:
		value = null.FloatFrom(float64(typedValue))
	case *int64:
		if typedValue == nil {
			value.Valid = false
		} else {
			value = null.FloatFrom(float64(*typedValue))
		}
	case int32:
		value = null.FloatFrom(float64(typedValue))
	case *int32:
		if typedValue == nil {
			value.Valid = false
		} else {
			value = null.FloatFrom(float64(*typedValue))
		}
	case int16:
		value = null.FloatFrom(float64(typedValue))
	case *int16:
		if typedValue == nil {
			value.Valid = false
		} else {
			value = null.FloatFrom(float64(*typedValue))
		}
	case int8:
		value = null.FloatFrom(float64(typedValue))
	case *int8:
		if typedValue == nil {
			value.Valid = false
		} else {
			value = null.FloatFrom(float64(*typedValue))
		}
	case uint:
		value = null.FloatFrom(float64(typedValue))
	case *uint:
		if typedValue == nil {
			value.Valid = false
		} else {
			value = null.FloatFrom(float64(*typedValue))
		}
	case uint64:
		value = null.FloatFrom(float64(typedValue))
	case *uint64:
		if typedValue == nil {
			value.Valid = false
		} else {
			value = null.FloatFrom(float64(*typedValue))
		}
	case uint32:
		value = null.FloatFrom(float64(typedValue))
	case *uint32:
		if typedValue == nil {
			value.Valid = false
		} else {
			value = null.FloatFrom(float64(*typedValue))
		}
	case uint16:
		value = null.FloatFrom(float64(typedValue))
	case *uint16:
		if typedValue == nil {
			value.Valid = false
		} else {
			value = null.FloatFrom(float64(*typedValue))
		}
	case uint8:
		value = null.FloatFrom(float64(typedValue))
	case *uint8:
		if typedValue == nil {
			value.Valid = false
		} else {
			value = null.FloatFrom(float64(*typedValue))
		}
	case float64:
		value = null.FloatFrom(typedValue)
	case *float64:
		value = null.FloatFromPtr(typedValue)
	case float32:
		value = null.FloatFrom(float64(typedValue))
	case *float32:
		if typedValue == nil {
			value.Valid = false
		} else {
			value = null.FloatFrom(float64(*typedValue))
		}
	case nil:
		value.Valid = false
	default:
		return null.NewFloat(0, false), fmt.Errorf(
			"value column must have numeric datatype, column: %s, type: %T, value: %v",
			columnName, typedValue, typedValue,
		)
	}

	return value, nil
}

func SetupFillmode(query plugins.DataSubQuery, interval time.Duration, fillmode string) error {
	query.Model.Set("fill", true)
	query.Model.Set("fillInterval", interval.Seconds())
	switch fillmode {
	case "NULL":
		query.Model.Set("fillMode", "null")
	case "previous":
		query.Model.Set("fillMode", "previous")
	default:
		query.Model.Set("fillMode", "value")
		floatVal, err := strconv.ParseFloat(fillmode, 64)
		if err != nil {
			return fmt.Errorf("error parsing fill value %v", fillmode)
		}
		query.Model.Set("fillValue", floatVal)
	}

	return nil
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

// epochPrecisionToMS converts epoch precision to millisecond, if needed.
// Only seconds to milliseconds supported right now
func epochPrecisionToMS(value float64) float64 {
	s := strconv.FormatFloat(value, 'e', -1, 64)
	if strings.HasSuffix(s, "e+09") {
		return value * float64(1e3)
	}

	if strings.HasSuffix(s, "e+18") {
		return value / float64(time.Millisecond)
	}

	return value
}
