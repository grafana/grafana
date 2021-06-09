package sqleng

import (
	"database/sql"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/data/sqlutil"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/tsdb/interval"
	"xorm.io/core"
)

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
	metricIndex       int
	rows              *core.Rows
	metricPrefix      bool
	queryContext      backend.DataQuery
}

func (e *dataPlugin) executeQuery(query backend.DataQuery, wg *sync.WaitGroup, queryContext backend.DataQuery,
	ch chan backend.DataResponse) {
	defer wg.Done()
	queryResult := backend.DataResponse{}
	// queryResult := plugins.DataQueryResult{
	// 	Meta:  simplejson.New(),
	// 	RefID: query.RefID,
	// }

	defer func() {
		if r := recover(); r != nil {
			e.log.Error("executeQuery panic", "error", r, "stack", log.Stack(1))
			if theErr, ok := r.(error); ok {
				queryResult.Error = theErr
			} else if theErrString, ok := r.(string); ok {
				queryResult.Error = fmt.Errorf(theErrString)
			} else {
				queryResult.Error = fmt.Errorf("unexpected error, see the server log for details")
			}
			ch <- queryResult
		}
	}()
	model, err := simplejson.NewJson(query.JSON)
	if err != nil {
		queryResult.Error = err
		ch <- queryResult
		return
	}
	rawSQL := model.Get("rawSql").MustString()
	if rawSQL == "" {
		panic("Query model property rawSql should not be empty at this point")
	}

	timeRange := queryContext.TimeRange

	// global substitutions
	interpolatedQuery, err := Interpolate(query, timeRange, rawSQL)
	if err != nil {
		queryResult.Error = err
		ch <- queryResult
		return
	}

	// data source specific substitutions
	interpolatedQuery, err = e.macroEngine.Interpolate(query, timeRange, interpolatedQuery)
	if err != nil {
		queryResult.Error = err
		ch <- queryResult
		return
	}

	errAppendDebug := func(frameErr string, err error) {
		var emptyFrame data.Frame
		emptyFrame.SetMeta(&data.FrameMeta{
			ExecutedQueryString: interpolatedQuery,
		})
		queryResult.Error = fmt.Errorf("%s: %w", frameErr, err)
		queryResult.Frames = data.Frames{&emptyFrame}
		ch <- queryResult
	}
	session := e.engine.NewSession()
	defer session.Close()
	db := session.DB()

	rows, err := db.Query(interpolatedQuery)
	if err != nil {
		errAppendDebug("db query error", e.transformQueryError(err))
		return
	}
	defer func() {
		if err := rows.Close(); err != nil {
			e.log.Warn("Failed to close rows", "err", err)
		}
	}()

	qm, err := e.newProcessCfg(query, queryContext, rows, interpolatedQuery)
	if err != nil {
		errAppendDebug("failed to get configurations", err)
		return
	}

	// Convert row.Rows to dataframe
	stringConverters := e.queryResultTransformer.GetConverterList()
	frame, err := sqlutil.FrameFromRows(rows.Rows, rowLimit, sqlutil.ToConverters(stringConverters...)...)
	if err != nil {
		errAppendDebug("convert frame from rows error", err)
		return
	}

	frame.SetMeta(&data.FrameMeta{
		ExecutedQueryString: interpolatedQuery,
	})

	// If no rows were returned, no point checking anything else.
	if frame.Rows() == 0 {
		return
	}

	if qm.timeIndex != -1 {
		if err := convertSQLTimeColumnToEpochMS(frame, qm.timeIndex); err != nil {
			errAppendDebug("db convert time column failed", err)
			return
		}
	}

	if qm.Format == dataQueryFormatSeries {
		// time series has to have time column
		if qm.timeIndex == -1 {
			errAppendDebug("db has no time column", errors.New("no time column found"))
			return
		}
		for i := range qm.columnNames {
			if i == qm.timeIndex || i == qm.metricIndex {
				continue
			}

			var err error
			if frame, err = convertSQLValueColumnToFloat(frame, i); err != nil {
				errAppendDebug("convert value to float failed", err)
				return
			}
		}

		tsSchema := frame.TimeSeriesSchema()
		if tsSchema.Type == data.TimeSeriesTypeLong {
			var err error
			frame, err = data.LongToWide(frame, qm.FillMissing)
			if err != nil {
				errAppendDebug("failed to convert long to wide series when converting from dataframe", err)
				return
			}
		}
		if qm.FillMissing != nil {
			var err error
			frame, err = resample(frame, *qm)
			if err != nil {
				e.log.Error("Failed to resample dataframe", "err", err)
				frame.AppendNotices(data.Notice{Text: "Failed to resample dataframe", Severity: data.NoticeSeverityWarning})
			}
			if err := trim(frame, *qm); err != nil {
				e.log.Error("Failed to trim dataframe", "err", err)
				frame.AppendNotices(data.Notice{Text: "Failed to trim dataframe", Severity: data.NoticeSeverityWarning})
			}
		}
	}

	queryResult.Frames = data.Frames{frame}
	ch <- queryResult
}

// Interpolate provides global macros/substitutions for all sql datasources.
var Interpolate = func(query plugins.DataSubQuery, timeRange backend.TimeRange, sql string) (string, error) {
	minInterval, err := interval.GetIntervalFrom(query.DataSource, query.Model, time.Second*60)
	if err != nil {
		return "", err
	}
	interval := sqlIntervalCalculator.Calculate(timeRange, minInterval)
	sql = strings.ReplaceAll(sql, "$__interval_ms", strconv.FormatInt(interval.Milliseconds(), 10))
	sql = strings.ReplaceAll(sql, "$__interval", interval.Text)

	sql = strings.ReplaceAll(sql, "$__unixEpochFrom()", fmt.Sprintf("%d", timeRange.From.Unix()))
	sql = strings.ReplaceAll(sql, "$__unixEpochTo()", fmt.Sprintf("%d", timeRange.To.Unix()))

	return sql, nil
}

//nolint: staticcheck // plugins.DataPlugin deprecated
func (e *dataPlugin) newProcessCfg(query plugins.DataSubQuery, queryContext backend.DataQuery,
	rows *core.Rows, interpolatedQuery string) (*dataQueryModel, error) {
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
		rows:         rows,
		timeIndex:    -1,
		metricIndex:  -1,
		metricPrefix: false,
		queryContext: queryContext,
	}

	if query.Model.Get("fill").MustBool(false) {
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
		default:
		}
	}
	//nolint: staticcheck // plugins.DataPlugin deprecated

	qm.TimeRange.From = queryContext.TimeRange.From.UTC()
	qm.TimeRange.To = queryContext.TimeRange.To.UTC()

	format := query.Model.Get("format").MustString("time_series")
	switch format {
	case "time_series":
		qm.Format = dataQueryFormatSeries
	case "table":
		qm.Format = dataQueryFormatTable
	default:
		panic(fmt.Sprintf("Unrecognized query model format: %q", format))
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
	qm.InterpolatedQuery = interpolatedQuery
	return qm, nil
}

// convertSQLValueColumnToFloat converts timeseries value column to float.
//nolint: gocyclo
func convertSQLValueColumnToFloat(frame *data.Frame, Index int) (*data.Frame, error) {
	if Index < 0 || Index >= len(frame.Fields) {
		return frame, fmt.Errorf("metricIndex %d is out of range", Index)
	}

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
		return frame, fmt.Errorf("metricIndex %d type can't be converted to float", Index)
	}
	frame.Fields[Index] = newField
	return frame, nil
}

func SetupFillmode(query *backend.DataQuery, interval time.Duration, fillmode string) error {
	model, err := simplejson.NewJson(query.JSON)
	if err != nil {
		return err
	}
	model.Set("fill", true)
	model.Set("fillInterval", interval.Seconds())
	switch fillmode {
	case "NULL":
		model.Set("fillMode", "null")
	case "previous":
		model.Set("fillMode", "previous")
	default:
		model.Set("fillMode", "value")
		floatVal, err := strconv.ParseFloat(fillmode, 64)
		if err != nil {
			return fmt.Errorf("error parsing fill value %v", fillmode)
		}
		model.Set("fillValue", floatVal)
	}
	if query.JSON, err = model.MarshalJSON(); err != nil {
		return err
	}
	return nil
}

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

func convertInt64ToEpochMS(origin *data.Field, newField *data.Field) {
	valueLength := origin.Len()
	for i := 0; i < valueLength; i++ {
		value := time.Unix(0, int64(epochPrecisionToMS(float64(origin.At(i).(int64))))*int64(time.Millisecond))
		newField.Append(&value)
	}
}

func convertNullableInt64ToEpochMS(origin *data.Field, newField *data.Field) {
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

func convertUInt64ToEpochMS(origin *data.Field, newField *data.Field) {
	valueLength := origin.Len()
	for i := 0; i < valueLength; i++ {
		value := time.Unix(0, int64(epochPrecisionToMS(float64(origin.At(i).(uint64))))*int64(time.Millisecond))
		newField.Append(&value)
	}
}

func convertNullableUInt64ToEpochMS(origin *data.Field, newField *data.Field) {
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

func convertInt32ToEpochMS(origin *data.Field, newField *data.Field) {
	valueLength := origin.Len()
	for i := 0; i < valueLength; i++ {
		value := time.Unix(0, int64(epochPrecisionToMS(float64(origin.At(i).(int32))))*int64(time.Millisecond))
		newField.Append(&value)
	}
}

func convertNullableInt32ToEpochMS(origin *data.Field, newField *data.Field) {
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

func convertUInt32ToEpochMS(origin *data.Field, newField *data.Field) {
	valueLength := origin.Len()
	for i := 0; i < valueLength; i++ {
		value := time.Unix(0, int64(epochPrecisionToMS(float64(origin.At(i).(uint32))))*int64(time.Millisecond))
		newField.Append(&value)
	}
}

func convertNullableUInt32ToEpochMS(origin *data.Field, newField *data.Field) {
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

func convertFloat64ToEpochMS(origin *data.Field, newField *data.Field) {
	valueLength := origin.Len()
	for i := 0; i < valueLength; i++ {
		value := time.Unix(0, int64(epochPrecisionToMS(origin.At(i).(float64)))*int64(time.Millisecond))
		newField.Append(&value)
	}
}

func convertNullableFloat64ToEpochMS(origin *data.Field, newField *data.Field) {
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

func convertFloat32ToEpochMS(origin *data.Field, newField *data.Field) {
	valueLength := origin.Len()
	for i := 0; i < valueLength; i++ {
		value := time.Unix(0, int64(epochPrecisionToMS(float64(origin.At(i).(float32))))*int64(time.Millisecond))
		newField.Append(&value)
	}
}

func convertNullableFloat32ToEpochMS(origin *data.Field, newField *data.Field) {
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

	switch valueType {
	case data.FieldTypeInt64:
		convertInt64ToEpochMS(frame.Fields[timeIndex], newField)
	case data.FieldTypeNullableInt64:
		convertNullableInt64ToEpochMS(frame.Fields[timeIndex], newField)
	case data.FieldTypeUint64:
		convertUInt64ToEpochMS(frame.Fields[timeIndex], newField)
	case data.FieldTypeNullableUint64:
		convertNullableUInt64ToEpochMS(frame.Fields[timeIndex], newField)
	case data.FieldTypeInt32:
		convertInt32ToEpochMS(frame.Fields[timeIndex], newField)
	case data.FieldTypeNullableInt32:
		convertNullableInt32ToEpochMS(frame.Fields[timeIndex], newField)
	case data.FieldTypeUint32:
		convertUInt32ToEpochMS(frame.Fields[timeIndex], newField)
	case data.FieldTypeNullableUint32:
		convertNullableUInt32ToEpochMS(frame.Fields[timeIndex], newField)
	case data.FieldTypeFloat64:
		convertFloat64ToEpochMS(frame.Fields[timeIndex], newField)
	case data.FieldTypeNullableFloat64:
		convertNullableFloat64ToEpochMS(frame.Fields[timeIndex], newField)
	case data.FieldTypeFloat32:
		convertFloat32ToEpochMS(frame.Fields[timeIndex], newField)
	case data.FieldTypeNullableFloat32:
		convertNullableFloat32ToEpochMS(frame.Fields[timeIndex], newField)
	default:
		return fmt.Errorf("column type %q is not convertible to time.Time", valueType)
	}
	frame.Fields[timeIndex] = newField

	return nil
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
