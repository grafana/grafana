package sqleng

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"regexp"
	"runtime/debug"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/gtime"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/data/sqlutil"
)

// MetaKeyExecutedQueryString is the key where the executed query should get stored
const MetaKeyExecutedQueryString = "executedQueryString"

// SQLMacroEngine interpolates macros into sql. It takes in the Query to have access to query context and
// timeRange to be able to generate queries that use from and to.
type SQLMacroEngine interface {
	Interpolate(query *backend.DataQuery, timeRange backend.TimeRange, sql string) (string, error)
}

// SqlQueryResultTransformer transforms a query result row to RowValues with proper types.
type SqlQueryResultTransformer interface {
	// TransformQueryError transforms a query error.
	TransformQueryError(logger log.Logger, err error) error
	GetConverterList() []sqlutil.StringConverter
}

type JsonData struct {
	MaxOpenConns            int    `json:"maxOpenConns"`
	MaxIdleConns            int    `json:"maxIdleConns"`
	ConnMaxLifetime         int    `json:"connMaxLifetime"`
	ConnectionTimeout       int    `json:"connectionTimeout"`
	Timescaledb             bool   `json:"timescaledb"`
	Mode                    string `json:"sslmode"`
	ConfigurationMethod     string `json:"tlsConfigurationMethod"`
	TlsSkipVerify           bool   `json:"tlsSkipVerify"`
	RootCertFile            string `json:"sslRootCertFile"`
	CertFile                string `json:"sslCertFile"`
	CertKeyFile             string `json:"sslKeyFile"`
	Timezone                string `json:"timezone"`
	Encrypt                 string `json:"encrypt"`
	Servername              string `json:"servername"`
	TimeInterval            string `json:"timeInterval"`
	Database                string `json:"database"`
	SecureDSProxy           bool   `json:"enableSecureSocksProxy"`
	SecureDSProxyUsername   string `json:"secureSocksProxyUsername"`
	AllowCleartextPasswords bool   `json:"allowCleartextPasswords"`
	AuthenticationType      string `json:"authenticationType"`
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
	RawSql       string  `json:"rawSql"`
	Fill         bool    `json:"fill"`
	FillInterval float64 `json:"fillInterval"`
	FillMode     string  `json:"fillMode"`
	FillValue    float64 `json:"fillValue"`
	Format       string  `json:"format"`
}

func (e *DataSourceHandler) TransformQueryError(logger log.Logger, err error) error {
	// OpError is the error type usually returned by functions in the net
	// package. It describes the operation, network type, and address of
	// an error. We log this error rather than return it to the client
	// for security purposes.
	var opErr *net.OpError
	if errors.As(err, &opErr) {
		logger.Error("Query error", "err", err)
		return fmt.Errorf("failed to connect to server - %s", e.userError)
	}

	return e.queryResultTransformer.TransformQueryError(logger, err)
}

func NewQueryDataHandler(userFacingDefaultError string, db *sql.DB, config DataPluginConfiguration, queryResultTransformer SqlQueryResultTransformer,
	macroEngine SQLMacroEngine, log log.Logger) (*DataSourceHandler, error) {
	queryDataHandler := DataSourceHandler{
		queryResultTransformer: queryResultTransformer,
		macroEngine:            macroEngine,
		timeColumnNames:        []string{"time"},
		log:                    log,
		dsInfo:                 config.DSInfo,
		rowLimit:               config.RowLimit,
		userError:              userFacingDefaultError,
	}

	if len(config.TimeColumnNames) > 0 {
		queryDataHandler.timeColumnNames = config.TimeColumnNames
	}

	if len(config.MetricColumnTypes) > 0 {
		queryDataHandler.metricColumnTypes = config.MetricColumnTypes
	}

	queryDataHandler.db = db
	return &queryDataHandler, nil
}

type DBDataResponse struct {
	dataResponse backend.DataResponse
	refID        string
}

func (e *DataSourceHandler) Dispose() {
	e.log.Debug("Disposing DB...")
	if e.db != nil {
		if err := e.db.Close(); err != nil {
			e.log.Error("Failed to dispose db", "error", err)
		}
	}
	e.log.Debug("DB disposed")
}

func (e *DataSourceHandler) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	result := backend.NewQueryDataResponse()
	ch := make(chan DBDataResponse, len(req.Queries))
	var wg sync.WaitGroup
	// Execute each query in a goroutine and wait for them to finish afterwards
	for _, query := range req.Queries {
		queryjson := QueryJson{
			Fill:   false,
			Format: "time_series",
		}
		err := json.Unmarshal(query.JSON, &queryjson)
		if err != nil {
			return nil, fmt.Errorf("error unmarshal query json: %w", err)
		}

		// the fill-params are only stored inside this function, during query-interpolation. we do not support
		// sending them in "from the outside"
		if queryjson.Fill || queryjson.FillInterval != 0.0 || queryjson.FillMode != "" || queryjson.FillValue != 0.0 {
			return nil, fmt.Errorf("query fill-parameters not supported")
		}

		if queryjson.RawSql == "" {
			continue
		}

		wg.Add(1)
		go e.executeQuery(query, &wg, ctx, ch, queryjson)
	}

	wg.Wait()

	// Read results from channels
	close(ch)
	result.Responses = make(map[string]backend.DataResponse)
	for queryResult := range ch {
		result.Responses[queryResult.refID] = queryResult.dataResponse
	}

	return result, nil
}

func (e *DataSourceHandler) executeQuery(query backend.DataQuery, wg *sync.WaitGroup, queryContext context.Context,
	ch chan DBDataResponse, queryJson QueryJson) {
	defer wg.Done()
	queryResult := DBDataResponse{
		dataResponse: backend.DataResponse{},
		refID:        query.RefID,
	}

	logger := e.log.FromContext(queryContext)

	defer func() {
		if r := recover(); r != nil {
			logger.Error("ExecuteQuery panic", "error", r, "stack", string(debug.Stack()))
			if theErr, ok := r.(error); ok {
				queryResult.dataResponse.Error = theErr
				queryResult.dataResponse.ErrorSource = backend.ErrorSourcePlugin
			} else if theErrString, ok := r.(string); ok {
				queryResult.dataResponse.Error = errors.New(theErrString)
				queryResult.dataResponse.ErrorSource = backend.ErrorSourcePlugin
			} else {
				queryResult.dataResponse.Error = fmt.Errorf("unexpected error - %s", e.userError)
				queryResult.dataResponse.ErrorSource = backend.ErrorSourceDownstream
			}
			ch <- queryResult
		}
	}()

	if queryJson.RawSql == "" {
		panic("Query model property rawSql should not be empty at this point")
	}

	timeRange := query.TimeRange

	errAppendDebug := func(frameErr string, err error, query string, source backend.ErrorSource) {
		var emptyFrame data.Frame
		emptyFrame.SetMeta(&data.FrameMeta{
			ExecutedQueryString: query,
		})
		if backend.IsDownstreamError(err) {
			source = backend.ErrorSourceDownstream
		}
		queryResult.dataResponse.Error = fmt.Errorf("%s: %w", frameErr, err)
		queryResult.dataResponse.ErrorSource = source
		queryResult.dataResponse.Frames = data.Frames{&emptyFrame}
		ch <- queryResult
	}

	// global substitutions
	interpolatedQuery := Interpolate(query, timeRange, e.dsInfo.JsonData.TimeInterval, queryJson.RawSql)

	// data source specific substitutions
	interpolatedQuery, err := e.macroEngine.Interpolate(&query, timeRange, interpolatedQuery)
	if err != nil {
		errAppendDebug("interpolation failed", e.TransformQueryError(logger, err), interpolatedQuery, backend.ErrorSourcePlugin)
		return
	}

	rows, err := e.db.QueryContext(queryContext, interpolatedQuery)
	if err != nil {
		errAppendDebug("db query error", e.TransformQueryError(logger, err), interpolatedQuery, backend.ErrorSourceDownstream)
		return
	}
	defer func() {
		if err := rows.Close(); err != nil {
			logger.Warn("Failed to close rows", "err", err)
		}
	}()

	qm, err := e.newProcessCfg(query, queryContext, rows, interpolatedQuery)
	if err != nil {
		errAppendDebug("failed to get configurations", err, interpolatedQuery, backend.ErrorSourcePlugin)
		return
	}

	// Convert row.Rows to dataframe
	stringConverters := e.queryResultTransformer.GetConverterList()
	frame, err := sqlutil.FrameFromRows(rows, e.rowLimit, sqlutil.ToConverters(stringConverters...)...)
	if err != nil {
		errAppendDebug("convert frame from rows error", err, interpolatedQuery, backend.ErrorSourcePlugin)
		return
	}

	if frame.Meta == nil {
		frame.Meta = &data.FrameMeta{}
	}

	frame.Meta.ExecutedQueryString = interpolatedQuery

	// If no rows were returned, clear any previously set `Fields` with a single empty `data.Field` slice.
	// Then assign `queryResult.dataResponse.Frames` the current single frame with that single empty Field.
	// This assures 1) our visualization doesn't display unwanted empty fields, and also that 2)
	// additionally-needed frame data stays intact and is correctly passed to our visulization.
	if frame.Rows() == 0 {
		frame.Fields = []*data.Field{}
		queryResult.dataResponse.Frames = data.Frames{frame}
		ch <- queryResult
		return
	}

	if err := convertSQLTimeColumnsToEpochMS(frame, qm); err != nil {
		errAppendDebug("converting time columns failed", err, interpolatedQuery, backend.ErrorSourcePlugin)
		return
	}

	if qm.Format == dataQueryFormatSeries {
		// time series has to have time column
		if qm.timeIndex == -1 {
			errAppendDebug("db has no time column", errors.New("time column is missing; make sure your data includes a time column for time series format or switch to a table format that doesn't require it"), interpolatedQuery, backend.ErrorSourceDownstream)
			return
		}

		// Make sure to name the time field 'Time' to be backward compatible with Grafana pre-v8.
		frame.Fields[qm.timeIndex].Name = data.TimeSeriesTimeFieldName

		for i := range qm.columnNames {
			if i == qm.timeIndex || i == qm.metricIndex {
				continue
			}

			if t := frame.Fields[i].Type(); t == data.FieldTypeString || t == data.FieldTypeNullableString {
				continue
			}

			var err error
			if frame, err = convertSQLValueColumnToFloat(frame, i); err != nil {
				errAppendDebug("convert value to float failed", err, interpolatedQuery, backend.ErrorSourcePlugin)
				return
			}
		}

		tsSchema := frame.TimeSeriesSchema()
		if tsSchema.Type == data.TimeSeriesTypeLong {
			var err error
			originalData := frame
			frame, err = data.LongToWide(frame, qm.FillMissing)
			if err != nil {
				errAppendDebug("failed to convert long to wide series when converting from dataframe", err, interpolatedQuery, backend.ErrorSourcePlugin)
				return
			}

			// Before 8x, a special metric column was used to name time series. The LongToWide transforms that into a metric label on the value field.
			// But that makes series name have both the value column name AND the metric name. So here we are removing the metric label here and moving it to the
			// field name to get the same naming for the series as pre v8
			if len(originalData.Fields) == 3 {
				for _, field := range frame.Fields {
					if len(field.Labels) == 1 { // 7x only supported one label
						name, ok := field.Labels["metric"]
						if ok {
							field.Name = name
							field.Labels = nil
						}
					}
				}
			}
		}
		if qm.FillMissing != nil {
			// we align the start-time
			startUnixTime := qm.TimeRange.From.Unix() / int64(qm.Interval.Seconds()) * int64(qm.Interval.Seconds())
			alignedTimeRange := backend.TimeRange{
				From: time.Unix(startUnixTime, 0),
				To:   qm.TimeRange.To,
			}

			var err error
			frame, err = sqlutil.ResampleWideFrame(frame, qm.FillMissing, alignedTimeRange, qm.Interval)
			if err != nil {
				logger.Error("Failed to resample dataframe", "err", err)
				frame.AppendNotices(data.Notice{Text: "Failed to resample dataframe", Severity: data.NoticeSeverityWarning})
			}
		}
	}

	queryResult.dataResponse.Frames = data.Frames{frame}
	ch <- queryResult
}

// Interpolate provides global macros/substitutions for all sql datasources.
var Interpolate = func(query backend.DataQuery, timeRange backend.TimeRange, timeInterval string, sql string) string {
	interval := query.Interval

	sql = strings.ReplaceAll(sql, "$__interval_ms", strconv.FormatInt(interval.Milliseconds(), 10))
	sql = strings.ReplaceAll(sql, "$__interval", gtime.FormatInterval(interval))
	sql = strings.ReplaceAll(sql, "$__unixEpochFrom()", fmt.Sprintf("%d", timeRange.From.UTC().Unix()))
	sql = strings.ReplaceAll(sql, "$__unixEpochTo()", fmt.Sprintf("%d", timeRange.To.UTC().Unix()))

	return sql
}

func (e *DataSourceHandler) newProcessCfg(query backend.DataQuery, queryContext context.Context,
	rows *sql.Rows, interpolatedQuery string) (*dataQueryModel, error) {
	columnNames, err := rows.Columns()
	if err != nil {
		return nil, err
	}
	columnTypes, err := rows.ColumnTypes()
	if err != nil {
		return nil, err
	}

	qm := &dataQueryModel{
		columnTypes:  columnTypes,
		columnNames:  columnNames,
		timeIndex:    -1,
		timeEndIndex: -1,
		metricIndex:  -1,
		metricPrefix: false,
		queryContext: queryContext,
	}

	queryJson := QueryJson{}
	err = json.Unmarshal(query.JSON, &queryJson)
	if err != nil {
		return nil, err
	}

	if queryJson.Fill {
		qm.FillMissing = &data.FillMissing{}
		qm.Interval = time.Duration(queryJson.FillInterval * float64(time.Second))
		switch strings.ToLower(queryJson.FillMode) {
		case "null":
			qm.FillMissing.Mode = data.FillModeNull
		case "previous":
			qm.FillMissing.Mode = data.FillModePrevious
		case "value":
			qm.FillMissing.Mode = data.FillModeValue
			qm.FillMissing.Value = queryJson.FillValue
		default:
		}
	}

	qm.TimeRange.From = query.TimeRange.From.UTC()
	qm.TimeRange.To = query.TimeRange.To.UTC()

	switch queryJson.Format {
	case "time_series":
		qm.Format = dataQueryFormatSeries
	case "table":
		qm.Format = dataQueryFormatTable
	default:
		panic(fmt.Sprintf("Unrecognized query model format: %q", queryJson.Format))
	}

	for i, col := range qm.columnNames {
		for _, tc := range e.timeColumnNames {
			if col == tc {
				qm.timeIndex = i
				break
			}
		}

		if qm.Format == dataQueryFormatTable && col == "timeend" {
			qm.timeEndIndex = i
			continue
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
	qm.InterpolatedQuery = interpolatedQuery
	return qm, nil
}

// dataQueryFormat is the type of query.
type dataQueryFormat string

const (
	// dataQueryFormatTable identifies a table query (default).
	dataQueryFormatTable dataQueryFormat = "table"
	// dataQueryFormatSeries identifies a time series query.
	dataQueryFormatSeries dataQueryFormat = "time_series"
)

type dataQueryModel struct {
	InterpolatedQuery string // property not set until after Interpolate()
	Format            dataQueryFormat
	TimeRange         backend.TimeRange
	FillMissing       *data.FillMissing // property not set until after Interpolate()
	Interval          time.Duration
	columnNames       []string
	columnTypes       []*sql.ColumnType
	timeIndex         int
	timeEndIndex      int
	metricIndex       int
	metricPrefix      bool
	queryContext      context.Context
}

func convertSQLTimeColumnsToEpochMS(frame *data.Frame, qm *dataQueryModel) error {
	if qm.timeIndex != -1 {
		if err := convertSQLTimeColumnToEpochMS(frame, qm.timeIndex); err != nil {
			return fmt.Errorf("%v: %w", "failed to convert time column", err)
		}
	}

	if qm.timeEndIndex != -1 {
		if err := convertSQLTimeColumnToEpochMS(frame, qm.timeEndIndex); err != nil {
			return fmt.Errorf("%v: %w", "failed to convert timeend column", err)
		}
	}

	return nil
}

// convertSQLTimeColumnToEpochMS converts column named time to unix timestamp in milliseconds
// to make native datetime types and epoch dates work in annotation and table queries.
func convertSQLTimeColumnToEpochMS(frame *data.Frame, timeIndex int) error {
	if timeIndex < 0 || timeIndex >= len(frame.Fields) {
		return fmt.Errorf("timeIndex %d is out of range", timeIndex)
	}

	origin := frame.Fields[timeIndex]
	valueType := origin.Type()
	if valueType == data.FieldTypeTime || valueType == data.FieldTypeNullableTime {
		return nil
	}

	newField := data.NewFieldFromFieldType(data.FieldTypeNullableTime, 0)
	newField.Name = origin.Name
	newField.Labels = origin.Labels

	valueLength := origin.Len()
	for i := 0; i < valueLength; i++ {
		v, err := origin.NullableFloatAt(i)
		if err != nil {
			return fmt.Errorf("unable to convert data to a time field")
		}
		if v == nil {
			newField.Append(nil)
		} else {
			timestamp := time.Unix(0, int64(epochPrecisionToMS(*v))*int64(time.Millisecond))
			newField.Append(&timestamp)
		}
	}
	frame.Fields[timeIndex] = newField

	return nil
}

// convertSQLValueColumnToFloat converts timeseries value column to float.
func convertSQLValueColumnToFloat(frame *data.Frame, Index int) (*data.Frame, error) {
	if Index < 0 || Index >= len(frame.Fields) {
		return frame, fmt.Errorf("metricIndex %d is out of range", Index)
	}

	origin := frame.Fields[Index]
	valueType := origin.Type()
	if valueType == data.FieldTypeFloat64 || valueType == data.FieldTypeNullableFloat64 {
		return frame, nil
	}

	newField := data.NewFieldFromFieldType(data.FieldTypeNullableFloat64, origin.Len())
	newField.Name = origin.Name
	newField.Labels = origin.Labels

	for i := 0; i < origin.Len(); i++ {
		v, err := origin.NullableFloatAt(i)
		if err != nil {
			return frame, err
		}
		newField.Set(i, v)
	}

	frame.Fields[Index] = newField

	return frame, nil
}

func SetupFillmode(query *backend.DataQuery, interval time.Duration, fillmode string) error {
	rawQueryProp := make(map[string]any)
	queryBytes, err := query.JSON.MarshalJSON()
	if err != nil {
		return err
	}
	err = json.Unmarshal(queryBytes, &rawQueryProp)
	if err != nil {
		return err
	}
	rawQueryProp["fill"] = true
	rawQueryProp["fillInterval"] = interval.Seconds()

	switch fillmode {
	case "NULL":
		rawQueryProp["fillMode"] = "null"
	case "previous":
		rawQueryProp["fillMode"] = "previous"
	default:
		rawQueryProp["fillMode"] = "value"
		floatVal, err := strconv.ParseFloat(fillmode, 64)
		if err != nil {
			return fmt.Errorf("error parsing fill value %v", fillmode)
		}
		rawQueryProp["fillValue"] = floatVal
	}
	query.JSON, err = json.Marshal(rawQueryProp)
	if err != nil {
		return err
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

	for _, v := range re.FindAllStringSubmatchIndex(str, -1) {
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
