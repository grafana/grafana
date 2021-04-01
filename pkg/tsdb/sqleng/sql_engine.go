package sqleng

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/data/sqlutil"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/tsdb/interval"
	"xorm.io/core"
	"xorm.io/xorm"
)

// MetaKeyExecutedQueryString is the key where the executed query should get stored
const MetaKeyExecutedQueryString = "executedQueryString"

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

	GetConverterList() []sqlutil.StringConverter
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

// func getFillMissing(query *plugins.DataSubQuery, qm *DataQueryModel) {
// 	isFillMissing := query.Model.Get("fill").MustBool(false)
// 	if isFillMissing {
// 		qm.FillMissing = &data.FillMissing{}
// 		fmt.Println(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>fuck")
// 		qm.Interval = time.Duration(query.Model.Get("fillInterval").MustFloat64() * float64(time.Second))
// 		fmt.Println(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>fuckfuck")
// 		switch strings.ToLower(query.Model.Get("fillMode").MustString()) {
// 		case "null":
// 			qm.FillMissing.Mode = data.FillModeNull
// 		case "previous":
// 			qm.FillMissing.Mode = data.FillModePrevious
// 		case "value":
// 			qm.FillMissing.Mode = data.FillModeValue
// 			qm.FillMissing.Value = query.Model.Get("fillValue").MustFloat64()
// 		}
// 	}
// }

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
			frames := data.Frames{}
			queryResult := plugins.DataQueryResult{
				Meta:  simplejson.New(),
				RefID: query.RefID,
			}

			rawSQL := query.Model.Get("rawSql").MustString()
			if rawSQL == "" {
				panic("Query model property rawSql should not be empty at this point")
			}

			preInterpolatedQuery := rawSQL

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
			interpolatedQuery := rawSQL
			queryResult.Meta.Set(MetaKeyExecutedQueryString, rawSQL)

			emptyFrame := &data.Frame{}
			emptyFrame.SetMeta(&data.FrameMeta{
				ExecutedQueryString: interpolatedQuery,
			})

			errAppendDebug := func(logErr string, frameErr string, err error) {
				backend.Logger.Error(logErr, "error", err)
				frames = append(frames, emptyFrame)
				queryResult.Error = fmt.Errorf(frameErr+": %w", err)
				queryResult.Dataframes = plugins.NewDecodedDataFrames(frames)
			}

			session := e.engine.NewSession()
			defer session.Close()
			db := session.DB()

			rows, err := db.Query(rawSQL)
			if err != nil {
				errAppendDebug("DB Query error", "db query error", err)
				queryResult.Error = e.queryResultTransformer.TransformQueryError(err)
				return
			}

			qm, err := e.newProcessCfg(query, queryContext, rows)
			qm.PreInterpolatedQuery = preInterpolatedQuery
			qm.InterpolatedQuery = interpolatedQuery

			if err != nil {
				errAppendDebug("fail when getting configurations", "fail when getting configurations", err)
				return
			}

			defer func() {
				if err := rows.Close(); err != nil {
					e.log.Warn("Failed to close rows", "err", err)
				}
			}()

			// Convert row.Rows to dataframe
			myCs := e.queryResultTransformer.GetConverterList()
			frame, _, err := sqlutil.FrameFromRows(rows.Rows, rowLimit, myCs...)
			// spew.Dump(foo)
			if err != nil {
				errAppendDebug("DB Query error", "db query error", err)
				return
			}
			frame.SetMeta(&data.FrameMeta{
				ExecutedQueryString: rawSQL,
			})

			// If no rows were returned, no point checking anything else.
			if frame.Rows() == 0 {
				return
			}
			// frame, foo, err := sqlutil.FrameFromRows(rows.Rows, rowLimit, myCs...)

			if qm.timeIndex != -1 {
				frame, _ = ConvertSqlTimeColumnToEpochMs(frame, qm.timeIndex)
			}

			if qm.Format == DataQueryFormatSeries {
				var err error
				// timeserie has to have time column
				if qm.timeIndex == -1 {
					errAppendDebug("DB get no time column", "db get no time column", errors.New("no time column found"))
					return
				}
				for i := range qm.columnNames {
					if i == qm.timeIndex || i == qm.metricIndex {
						continue
					}

					if frame, err = ConvertSqlValueColumnToFloat(frame, i); err != nil {
						errAppendDebug("Convert value to float failed", "Convert value to float failed",
							err)
						return
					}
				}

				tsSchema := frame.TimeSeriesSchema()
				backend.Logger.Debug("Timeseries schema", "schema", tsSchema.Type)

				if tsSchema.Type == data.TimeSeriesTypeLong {
					content, _ := frame.StringTable(-1, -1)
					fmt.Println("<<<<<<<<<<<<<<<<<<<<<<<<<< before convertion", content)
					frame, err = data.LongToWide(frame, qm.FillMissing)
					if err != nil {
						errAppendDebug("Failed to convert long to wide series when converting from dataframe", "failed to convert long to wide series when converting from dataframe", err)
						return
					}
				}
				if qm.FillMissing != nil {
					frame, err = resample(frame, *qm)
					if err != nil {
						backend.Logger.Debug("Failed to resample dataframe", "err", err)
						frame.AppendNotices(data.Notice{Text: "Failed to resample dataframe", Severity: data.NoticeSeverityWarning})
					}
					err = trim(frame, *qm)
					if err != nil {
						backend.Logger.Debug("Failed to resample dataframe", "err", err)
						frame.AppendNotices(data.Notice{Text: "Failed to resample dataframe", Severity: data.NoticeSeverityWarning})
					}
				}
			}
			content, _ := frame.StringTable(-1, -1)
			fmt.Println("<<<<<<<<<<<<<<<<<<<<<<<<<<", content)
			frames = append(frames, frame)
			queryResult.Dataframes = plugins.NewDecodedDataFrames(frames)

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

func (e *dataPlugin) newProcessCfg(query plugins.DataSubQuery, queryContext plugins.DataQuery, rows *core.Rows) (*DataQueryModel, error) {

	columnNames, err := rows.Columns()
	if err != nil {
		return nil, err
	}
	columnTypes, err := rows.ColumnTypes()
	if err != nil {
		return nil, err
	}

	qm := &DataQueryModel{
		columnTypes:  columnTypes,
		columnNames:  columnNames,
		rows:         rows,
		timeIndex:    -1,
		metricIndex:  -1,
		metricPrefix: false,
		FillMissing:  nil,
		queryContext: queryContext,
	}

	isFillMissing := query.Model.Get("fill").MustBool(false)
	if isFillMissing {
		qm.FillMissing = &data.FillMissing{}
		qm.Interval = time.Duration(query.Model.Get("fillInterval").MustFloat64() * float64(time.Second))
		switch strings.ToLower(query.Model.Get("fillMode").MustString()) {
		case "null":
			qm.FillMissing.Mode = data.FillModeNull
		case "previous":
			qm.FillMissing.Mode = data.FillModePrevious
		case "value":
			qm.FillMissing.Mode = data.FillModeValue
			qm.FillMissing.Value = query.Model.Get("fillValue").MustFloat64()
		}
	}

	var timeRange plugins.DataTimeRange
	if queryContext.TimeRange != nil {
		timeRange = *queryContext.TimeRange
		qm.TimeRange.From = timeRange.GetFromAsTimeUTC()
		qm.TimeRange.To = timeRange.GetToAsTimeUTC()
	}

	format := query.Model.Get("format").MustString("time_series")
	switch format {
	case "time_series":
		qm.Format = DataQueryFormatSeries
	case "table":
		qm.Format = DataQueryFormatTable
	}

	for i, col := range qm.columnNames {
		for _, tc := range e.timeColumnNames {
			if col == tc {
				qm.timeIndex = i
				break
			}
		}
		switch col {
		case "metric":
			qm.metricIndex = i
		default:
			if qm.metricIndex == -1 {
				columnType := qm.columnTypes[i].DatabaseTypeName()
				for _, mct := range e.metricColumnTypes {
					if columnType == mct {
						qm.metricIndex = i
						continue
					}
				}
			}
		}
	}

	return qm, nil
}

// func (e *dataPlugin) transformToTimeSeries(query plugins.DataSubQuery, rows *core.Rows,
// 	result *plugins.DataQueryResult, queryContext plugins.DataQuery) error {

// 	// the only difference between table and timeseries is that for timeserie we need to manage intervals

// 	cfg, err := newProcessCfg(query, queryContext, rows)
// 	if err != nil {
// 		return err
// 	}

// 	// check columns of resultset: a column named time is mandatory
// 	// the first text column is treated as metric name unless a column named metric is present
// 	for i, col := range cfg.columnNames {
// 		for _, tc := range e.timeColumnNames {
// 			if col == tc {
// 				cfg.timeIndex = i
// 				continue
// 			}
// 		}
// 		switch col {
// 		case "metric":
// 			cfg.metricIndex = i
// 		default:
// 			if cfg.metricIndex == -1 {
// 				columnType := cfg.columnTypes[i].DatabaseTypeName()

// 				for _, mct := range e.metricColumnTypes {
// 					if columnType == mct {
// 						cfg.metricIndex = i
// 						continue
// 					}
// 				}
// 			}
// 		}
// 	}

// 	// use metric column as prefix with multiple value columns
// 	if cfg.metricIndex != -1 && len(cfg.columnNames) > 3 {
// 		cfg.metricPrefix = true
// 	}

// 	if cfg.timeIndex == -1 {
// 		return fmt.Errorf("found no column named %q", strings.Join(e.timeColumnNames, " or "))
// 	}

// 	if cfg.fillMissing {
// 		cfg.fillInterval = query.Model.Get("fillInterval").MustFloat64() * 1000
// 		switch query.Model.Get("fillMode").MustString() {
// 		case "null":
// 		case "previous":
// 			cfg.fillPrevious = true
// 		case "value":
// 			cfg.fillValue.Float64 = query.Model.Get("fillValue").MustFloat64()
// 			cfg.fillValue.Valid = true
// 		}
// 	}

// 	for rows.Next() {
// 		if err := e.processRow(cfg); err != nil {
// 			return err
// 		}
// 	}

// 	for elem := cfg.seriesByQueryOrder.Front(); elem != nil; elem = elem.Next() {
// 		key := elem.Value.(string)
// 		if !cfg.fillMissing {
// 			result.Series = append(result.Series, *cfg.pointsBySeries[key])
// 			continue
// 		}

// 		series := cfg.pointsBySeries[key]
// 		// fill in values from last fetched value till interval end
// 		intervalStart := series.Points[len(series.Points)-1][1].Float64
// 		intervalEnd := float64(queryContext.TimeRange.MustGetTo().UnixNano() / 1e6)

// 		if cfg.fillPrevious {
// 			if len(series.Points) > 0 {
// 				cfg.fillValue = series.Points[len(series.Points)-1][0]
// 			} else {
// 				cfg.fillValue.Valid = false
// 			}
// 		}

// 		// align interval start
// 		intervalStart = math.Floor(intervalStart/cfg.fillInterval) * cfg.fillInterval
// 		for i := intervalStart + cfg.fillInterval; i < intervalEnd; i += cfg.fillInterval {
// 			series.Points = append(series.Points, plugins.DataTimePoint{cfg.fillValue, null.FloatFrom(i)})
// 			cfg.rowCount++
// 		}

// 		result.Series = append(result.Series, *series)
// 	}

// 	result.Meta.Set("rowCount", cfg.rowCount)
// 	return nil
// }

// type processCfg struct {
// 	rowCount           int
// 	columnTypes        []*sql.ColumnType
// 	columnNames        []string
// 	rows               *core.Rows
// 	timeIndex          int
// 	metricIndex        int
// 	metricPrefix       bool
// 	metricPrefixValue  string
// 	fillMissing        bool
// 	pointsBySeries     map[string]*plugins.DataTimeSeries
// 	seriesByQueryOrder *list.List
// 	fillValue          null.Float
// 	queryContext       plugins.DataQuery
// 	fillInterval       float64
// 	fillPrevious       bool
// }

// DataQueryFormat is the type of query.
type DataQueryFormat string

const (
	// DataQueryFormatTable identifies a table query (default).
	DataQueryFormatTable DataQueryFormat = "table"
	// DataQueryFormatSeries identifies a time series query.
	DataQueryFormatSeries DataQueryFormat = "time_series"
)

type DataQueryModel struct {
	PreInterpolatedQuery string
	InterpolatedQuery    string // property non set until after Interpolate()
	Format               DataQueryFormat
	TimeRange            backend.TimeRange
	FillMissing          *data.FillMissing // property non set until after Interpolate()
	Interval             time.Duration
	columnNames          []string
	columnTypes          []*sql.ColumnType
	timeIndex            int
	metricIndex          int
	rows                 *core.Rows
	metricPrefix         bool
	queryContext         plugins.DataQuery
}

// func (e *dataPlugin) processRow(cfg *processCfg) error {
// 	var timestamp float64
// 	var value null.Float
// 	var metric string

// 	if cfg.rowCount > rowLimit {
// 		return fmt.Errorf("query row limit exceeded, limit %d", rowLimit)
// 	}

// 	values, err := e.queryResultTransformer.TransformQueryResult(cfg.columnTypes, cfg.rows)
// 	if err != nil {
// 		return err
// 	}

// 	// converts column named time to unix timestamp in milliseconds to make
// 	// native mysql datetime types and epoch dates work in
// 	// annotation and table queries.
// 	ConvertSqlTimeColumnToEpochMs(values, cfg.timeIndex)

// 	switch columnValue := values[cfg.timeIndex].(type) {
// 	case int64:
// 		timestamp = float64(columnValue)
// 	case float64:
// 		timestamp = columnValue
// 	default:
// 		return fmt.Errorf("invalid type for column time, must be of type timestamp or unix timestamp, got: %T %v",
// 			columnValue, columnValue)
// 	}

// 	if cfg.metricIndex >= 0 {
// 		columnValue, ok := values[cfg.metricIndex].(string)
// 		if !ok {
// 			return fmt.Errorf("column metric must be of type %s. metric column name: %s type: %s but datatype is %T",
// 				strings.Join(e.metricColumnTypes, ", "), cfg.columnNames[cfg.metricIndex],
// 				cfg.columnTypes[cfg.metricIndex].DatabaseTypeName(), values[cfg.metricIndex])
// 		}

// 		if cfg.metricPrefix {
// 			cfg.metricPrefixValue = columnValue
// 		} else {
// 			metric = columnValue
// 		}
// 	}

// 	for i, col := range cfg.columnNames {
// 		if i == cfg.timeIndex || i == cfg.metricIndex {
// 			continue
// 		}

// 		if value, err = ConvertSqlValueColumnToFloat(col, values[i]); err != nil {
// 			return err
// 		}

// 		if cfg.metricIndex == -1 {
// 			metric = col
// 		} else if cfg.metricPrefix {
// 			metric = cfg.metricPrefixValue + " " + col
// 		}

// 		series, exists := cfg.pointsBySeries[metric]
// 		if !exists {
// 			series = &plugins.DataTimeSeries{Name: metric}
// 			cfg.pointsBySeries[metric] = series
// 			cfg.seriesByQueryOrder.PushBack(metric)
// 		}

// 		if cfg.fillMissing {
// 			var intervalStart float64
// 			if !exists {
// 				intervalStart = float64(cfg.queryContext.TimeRange.MustGetFrom().UnixNano() / 1e6)
// 			} else {
// 				intervalStart = series.Points[len(series.Points)-1][1].Float64 + cfg.fillInterval
// 			}

// 			if cfg.fillPrevious {
// 				if len(series.Points) > 0 {
// 					cfg.fillValue = series.Points[len(series.Points)-1][0]
// 				} else {
// 					cfg.fillValue.Valid = false
// 				}
// 			}

// 			// align interval start
// 			intervalStart = math.Floor(intervalStart/cfg.fillInterval) * cfg.fillInterval

// 			for i := intervalStart; i < timestamp; i += cfg.fillInterval {
// 				series.Points = append(series.Points, plugins.DataTimePoint{cfg.fillValue, null.FloatFrom(i)})
// 				cfg.rowCount++
// 			}
// 		}

// 		series.Points = append(series.Points, plugins.DataTimePoint{value, null.FloatFrom(timestamp)})
// 		cfg.pointsBySeries[metric] = series

// 		// TODO: Make non-global
// 		if setting.Env == setting.Dev {
// 			e.log.Debug("Rows", "metric", metric, "time", timestamp, "value", value)
// 		}
// 	}

// 	return nil
// }

func convertInt64ToFloat64(origin *data.Field, newField *data.Field) {
	valueLength := origin.Len()
	for i := 0; i < valueLength; i++ {
		value := float64(origin.At(i).(int64))
		newField.Append(&value)
	}
}

func convertNullableInt64ToFloat64(origin *data.Field, newField *data.Field) {
	valueLength := origin.Len()
	for i := 0; i < valueLength; i++ {
		iv := origin.At(i).(*int64)
		if iv == nil {
			newField.Append(nil)
		} else {
			value := float64(*iv)
			newField.Append(&value)
		}
	}
}

func convertUInt64ToFloat64(origin *data.Field, newField *data.Field) {
	valueLength := origin.Len()
	for i := 0; i < valueLength; i++ {
		value := float64(origin.At(i).(uint64))
		newField.Append(&value)
	}
}

func convertNullableUInt64ToFloat64(origin *data.Field, newField *data.Field) {
	valueLength := origin.Len()
	for i := 0; i < valueLength; i++ {
		iv := origin.At(i).(*uint64)
		if iv == nil {
			newField.Append(nil)
		} else {
			value := float64(*iv)
			newField.Append(&value)
		}
	}
}

func convertInt32ToFloat64(origin *data.Field, newField *data.Field) {
	valueLength := origin.Len()
	for i := 0; i < valueLength; i++ {
		value := float64(origin.At(i).(int32))
		newField.Append(&value)
	}
}

func convertNullableInt32ToFloat64(origin *data.Field, newField *data.Field) {
	valueLength := origin.Len()
	for i := 0; i < valueLength; i++ {
		iv := origin.At(i).(*int32)
		if iv == nil {
			newField.Append(nil)
		} else {
			value := float64(*iv)
			newField.Append(&value)
		}
	}
}

func convertUInt32ToFloat64(origin *data.Field, newField *data.Field) {
	valueLength := origin.Len()
	for i := 0; i < valueLength; i++ {
		value := float64(origin.At(i).(uint32))
		newField.Append(&value)
	}
}

func convertNullableUInt32ToFloat64(origin *data.Field, newField *data.Field) {
	valueLength := origin.Len()
	for i := 0; i < valueLength; i++ {
		iv := origin.At(i).(*uint32)
		if iv == nil {
			newField.Append(nil)
		} else {
			value := float64(*iv)
			newField.Append(&value)
		}
	}
}

func convertInt16ToFloat64(origin *data.Field, newField *data.Field) {
	valueLength := origin.Len()
	for i := 0; i < valueLength; i++ {
		value := float64(origin.At(i).(int16))
		newField.Append(&value)
	}
}

func convertNullableInt16ToFloat64(origin *data.Field, newField *data.Field) {
	valueLength := origin.Len()
	for i := 0; i < valueLength; i++ {
		iv := origin.At(i).(*int16)
		if iv == nil {
			newField.Append(nil)
		} else {
			value := float64(*iv)
			newField.Append(&value)
		}
	}
}

func convertUInt16ToFloat64(origin *data.Field, newField *data.Field) {
	valueLength := origin.Len()
	for i := 0; i < valueLength; i++ {
		value := float64(origin.At(i).(uint16))
		newField.Append(&value)
	}
}

func convertNullableUInt16ToFloat64(origin *data.Field, newField *data.Field) {
	valueLength := origin.Len()
	for i := 0; i < valueLength; i++ {
		iv := origin.At(i).(*uint16)
		if iv == nil {
			newField.Append(nil)
		} else {
			value := float64(*iv)
			newField.Append(&value)
		}
	}
}

func convertInt8ToFloat64(origin *data.Field, newField *data.Field) {
	valueLength := origin.Len()
	for i := 0; i < valueLength; i++ {
		value := float64(origin.At(i).(int8))
		newField.Append(&value)
	}
}

func convertNullableInt8ToFloat64(origin *data.Field, newField *data.Field) {
	valueLength := origin.Len()
	for i := 0; i < valueLength; i++ {
		iv := origin.At(i).(*int8)
		if iv == nil {
			newField.Append(nil)
		} else {
			value := float64(*iv)
			newField.Append(&value)
		}
	}
}

func convertUInt8ToFloat64(origin *data.Field, newField *data.Field) {
	valueLength := origin.Len()
	for i := 0; i < valueLength; i++ {
		value := float64(origin.At(i).(uint8))
		newField.Append(&value)
	}
}

func convertNullableUInt8ToFloat64(origin *data.Field, newField *data.Field) {
	valueLength := origin.Len()
	for i := 0; i < valueLength; i++ {
		iv := origin.At(i).(*uint8)
		if iv == nil {
			newField.Append(nil)
		} else {
			value := float64(*iv)
			newField.Append(&value)
		}
	}
}

func convertUnknownToZero(origin *data.Field, newField *data.Field) {
	valueLength := origin.Len()
	for i := 0; i < valueLength; i++ {
		value := float64(0)
		newField.Append(&value)
	}
}

func convertNullableFloat32ToFloat64(origin *data.Field, newField *data.Field) {
	valueLength := origin.Len()
	for i := 0; i < valueLength; i++ {
		iv := origin.At(i).(*float32)
		if iv == nil {
			newField.Append(nil)
		} else {
			value := float64(*iv)
			newField.Append(&value)
		}
	}
}

func convertFloat32ToFloat64(origin *data.Field, newField *data.Field) {
	valueLength := origin.Len()
	for i := 0; i < valueLength; i++ {
		value := float64(origin.At(i).(float32))
		newField.Append(&value)
	}
}

func convertInt64ToEpochMs(origin *data.Field, newField *data.Field) {
	valueLength := origin.Len()
	for i := 0; i < valueLength; i++ {
		value := time.Unix(0, int64(epochPrecisionToMS(float64(origin.At(i).(int64))))*int64(time.Millisecond))
		newField.Append(&value)
	}
}

func convertNullableInt64ToEpochMs(origin *data.Field, newField *data.Field) {
	valueLength := origin.Len()
	for i := 0; i < valueLength; i++ {
		iv := origin.At(i).(*int64)
		if iv == nil {
			newField.Append(nil)
		} else {
			value := time.Unix(0, int64(epochPrecisionToMS(float64(*iv)))*int64(time.Millisecond))
			newField.Append(&value)
		}
	}
}

func convertUInt64ToEpochMs(origin *data.Field, newField *data.Field) {
	valueLength := origin.Len()
	for i := 0; i < valueLength; i++ {
		value := time.Unix(0, int64(epochPrecisionToMS(float64(origin.At(i).(uint64))))*int64(time.Millisecond))
		newField.Append(&value)
	}
}

func convertNullableUInt64ToEpochMs(origin *data.Field, newField *data.Field) {
	valueLength := origin.Len()
	for i := 0; i < valueLength; i++ {
		iv := origin.At(i).(*uint64)
		if iv == nil {
			newField.Append(nil)
		} else {
			value := time.Unix(0, int64(epochPrecisionToMS(float64(*iv)))*int64(time.Millisecond))
			newField.Append(&value)
		}
	}
}

func convertInt32ToEpochMs(origin *data.Field, newField *data.Field) {
	valueLength := origin.Len()
	for i := 0; i < valueLength; i++ {
		value := time.Unix(0, int64(epochPrecisionToMS(float64(origin.At(i).(int32))))*int64(time.Millisecond))
		newField.Append(&value)
	}
}

func convertNullableInt32ToEpochMs(origin *data.Field, newField *data.Field) {
	valueLength := origin.Len()
	for i := 0; i < valueLength; i++ {
		iv := origin.At(i).(*int32)
		if iv == nil {
			newField.Append(nil)
		} else {
			value := time.Unix(0, int64(epochPrecisionToMS(float64(*iv)))*int64(time.Millisecond))
			newField.Append(&value)
		}
	}
}

func convertUInt32ToEpochMs(origin *data.Field, newField *data.Field) {
	valueLength := origin.Len()
	for i := 0; i < valueLength; i++ {
		value := time.Unix(0, int64(epochPrecisionToMS(float64(origin.At(i).(uint32))))*int64(time.Millisecond))
		newField.Append(&value)
	}
}

func convertNullableUInt32ToEpochMs(origin *data.Field, newField *data.Field) {
	valueLength := origin.Len()
	for i := 0; i < valueLength; i++ {
		iv := origin.At(i).(*uint32)
		if iv == nil {
			newField.Append(nil)
		} else {
			value := time.Unix(0, int64(epochPrecisionToMS(float64(*iv)))*int64(time.Millisecond))
			newField.Append(&value)
		}
	}
}

func convertFloat64ToEpochMs(origin *data.Field, newField *data.Field) {
	valueLength := origin.Len()
	for i := 0; i < valueLength; i++ {
		value := time.Unix(0, int64(epochPrecisionToMS(origin.At(i).(float64)))*int64(time.Millisecond))
		newField.Append(&value)
	}
}

func convertNullableFloat64ToEpochMs(origin *data.Field, newField *data.Field) {
	valueLength := origin.Len()
	for i := 0; i < valueLength; i++ {
		iv := origin.At(i).(*float64)
		if iv == nil {
			newField.Append(nil)
		} else {
			value := time.Unix(0, int64(epochPrecisionToMS(*iv))*int64(time.Millisecond))
			newField.Append(&value)
		}
	}
}

func convertFloat32ToEpochMs(origin *data.Field, newField *data.Field) {
	valueLength := origin.Len()
	for i := 0; i < valueLength; i++ {
		value := time.Unix(0, int64(epochPrecisionToMS(float64(origin.At(i).(float32))))*int64(time.Millisecond))
		newField.Append(&value)
	}
}

func convertNullableFloat32ToEpochMs(origin *data.Field, newField *data.Field) {
	valueLength := origin.Len()
	for i := 0; i < valueLength; i++ {
		iv := origin.At(i).(*float32)
		if iv == nil {
			newField.Append(nil)
		} else {
			value := time.Unix(0, int64(epochPrecisionToMS(float64(*iv)))*int64(time.Millisecond))
			newField.Append(&value)
		}
	}
}

// ConvertSqlTimeColumnToEpochMs converts column named time to unix timestamp in milliseconds
// to make native datetime types and epoch dates work in annotation and table queries.
// func ConvertSqlTimeColumnToEpochMs(values plugins.DataRowValues, timeIndex int) {
func ConvertSqlTimeColumnToEpochMs(frame *data.Frame, timeIndex int) (*data.Frame, error) {
	if timeIndex >= 0 && timeIndex < len(frame.Fields) {
		origin := frame.Fields[timeIndex]
		valueType := origin.Type()
		if valueType == data.FieldTypeTime || valueType == data.FieldTypeNullableTime {
			return frame, nil
		}
		newField := data.NewFieldFromFieldType(data.FieldTypeNullableTime, 0)
		newField.Name = origin.Name
		newField.Labels = origin.Labels

		switch valueType {
		case data.FieldTypeInt64:
			convertInt64ToEpochMs(frame.Fields[timeIndex], newField)
		case data.FieldTypeNullableInt64:
			convertNullableInt64ToEpochMs(frame.Fields[timeIndex], newField)
		case data.FieldTypeUint64:
			convertUInt64ToEpochMs(frame.Fields[timeIndex], newField)
		case data.FieldTypeNullableUint64:
			convertNullableUInt64ToEpochMs(frame.Fields[timeIndex], newField)
		case data.FieldTypeInt32:
			convertInt32ToEpochMs(frame.Fields[timeIndex], newField)
		case data.FieldTypeNullableInt32:
			convertNullableInt32ToEpochMs(frame.Fields[timeIndex], newField)
		case data.FieldTypeUint32:
			convertUInt32ToEpochMs(frame.Fields[timeIndex], newField)
		case data.FieldTypeNullableUint32:
			convertNullableUInt32ToEpochMs(frame.Fields[timeIndex], newField)
		case data.FieldTypeFloat64:
			convertFloat64ToEpochMs(frame.Fields[timeIndex], newField)
		case data.FieldTypeNullableFloat64:
			convertNullableFloat64ToEpochMs(frame.Fields[timeIndex], newField)
		case data.FieldTypeFloat32:
			convertFloat32ToEpochMs(frame.Fields[timeIndex], newField)
		case data.FieldTypeNullableFloat32:
			convertNullableFloat32ToEpochMs(frame.Fields[timeIndex], newField)
		}
		frame.Fields[timeIndex] = newField
	} else {
		return frame, fmt.Errorf("timeIndex %d is out of range", timeIndex)
	}
	return frame, nil
}

// ConvertSqlValueColumnToFloat converts timeseries value column to float.
//nolint: gocyclo
func ConvertSqlValueColumnToFloat(frame *data.Frame, Index int) (*data.Frame, error) {
	if Index >= 0 && Index < len(frame.Fields) {
		origin := frame.Fields[Index]
		valueType := origin.Type()
		if valueType == data.FieldTypeFloat64 || valueType == data.FieldTypeNullableFloat64 {
			return frame, nil
		}

		newField := data.NewFieldFromFieldType(data.FieldTypeNullableFloat64, 0)
		newField.Name = origin.Name
		newField.Labels = origin.Labels

		switch valueType {
		case data.FieldTypeInt64:
			convertInt64ToFloat64(frame.Fields[Index], newField)
		case data.FieldTypeNullableInt64:
			convertNullableInt64ToFloat64(frame.Fields[Index], newField)
		case data.FieldTypeUint64:
			convertUInt64ToFloat64(frame.Fields[Index], newField)
		case data.FieldTypeNullableUint64:
			convertNullableUInt64ToFloat64(frame.Fields[Index], newField)
		case data.FieldTypeInt32:
			convertInt32ToFloat64(frame.Fields[Index], newField)
		case data.FieldTypeNullableInt32:
			convertNullableInt32ToFloat64(frame.Fields[Index], newField)
		case data.FieldTypeUint32:
			convertUInt32ToFloat64(frame.Fields[Index], newField)
		case data.FieldTypeNullableUint32:
			convertNullableUInt32ToFloat64(frame.Fields[Index], newField)
		case data.FieldTypeInt16:
			convertInt16ToFloat64(frame.Fields[Index], newField)
		case data.FieldTypeNullableInt16:
			convertNullableInt16ToFloat64(frame.Fields[Index], newField)
		case data.FieldTypeUint16:
			convertUInt16ToFloat64(frame.Fields[Index], newField)
		case data.FieldTypeNullableUint16:
			convertNullableUInt16ToFloat64(frame.Fields[Index], newField)
		case data.FieldTypeInt8:
			convertInt8ToFloat64(frame.Fields[Index], newField)
		case data.FieldTypeNullableInt8:
			convertNullableInt8ToFloat64(frame.Fields[Index], newField)
		case data.FieldTypeUint8:
			convertUInt8ToFloat64(frame.Fields[Index], newField)
		case data.FieldTypeNullableUint8:
			convertNullableUInt8ToFloat64(frame.Fields[Index], newField)
		case data.FieldTypeFloat32:
			convertFloat32ToFloat64(frame.Fields[Index], newField)
		case data.FieldTypeNullableFloat32:
			convertNullableFloat32ToFloat64(frame.Fields[Index], newField)
		default:
			convertUnknownToZero(frame.Fields[Index], newField)
			frame.Fields[Index] = newField
			return frame, fmt.Errorf("metricIndex %d type can't be convert to float", Index)
		}
		frame.Fields[Index] = newField
	} else {
		return frame, fmt.Errorf("metricIndex %d is out of range", Index)
	}
	return frame, nil
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
