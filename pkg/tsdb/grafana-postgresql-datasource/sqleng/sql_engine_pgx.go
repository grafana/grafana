package sqleng

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"runtime/debug"
	"strings"
	"sync"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/data/sqlutil"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

func NewQueryDataHandlerPGX(userFacingDefaultError string, p *pgxpool.Pool, config DataPluginConfiguration, queryResultTransformer SqlQueryResultTransformer,
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

	queryDataHandler.p = p
	return &queryDataHandler, nil
}

func (e *DataSourceHandler) DisposePGX(ctx context.Context) {
	e.log.Debug("Disposing DB...")

	e.p.Close()

	e.log.Debug("DB disposed")
}

func (e *DataSourceHandler) PingPGX(ctx context.Context) error {
	return e.p.Ping(ctx)
}

func (e *DataSourceHandler) QueryDataPGX(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
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
		go e.executeQueryPGX(query, &wg, ctx, ch, queryjson)
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

func (e *DataSourceHandler) executeQueryPGX(query backend.DataQuery, wg *sync.WaitGroup, queryContext context.Context,
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

	c, err := e.p.Acquire(queryContext)
	if err != nil {
		errAppendDebug("failed to acquire connection", err, interpolatedQuery, backend.ErrorSourcePlugin)
		return
	}
	defer c.Release()

	// We need to use Exec in here because we need to support multiple statements
	mrr := c.Conn().PgConn().Exec(queryContext, interpolatedQuery)
	defer func() {
		if err := mrr.Close(); err != nil {
			errAppendDebug("failed to close reader", err, interpolatedQuery, backend.ErrorSourcePlugin)
		}
	}()
	results, err := mrr.ReadAll()
	if err != nil {
		errAppendDebug("failed to read rows", err, interpolatedQuery, backend.ErrorSourcePlugin)
		return
	}

	qm, err := e.newProcessCfgPGX(query, queryContext, results, interpolatedQuery)
	if err != nil {
		errAppendDebug("failed to get configurations", err, interpolatedQuery, backend.ErrorSourcePlugin)
		return
	}

	// Convert row.Rows to dataframe
	frame, err := convertResultsToFrame(results, interpolatedQuery, e.rowLimit)
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

func (e *DataSourceHandler) newProcessCfgPGX(query backend.DataQuery, queryContext context.Context,
	results []*pgconn.Result, interpolatedQuery string) (*dataQueryModel, error) {
	columnNames := []string{}
	columnTypesPGX := []string{}

	// The results will contain column information in the metadata
	for _, result := range results {
		// Get column names from the result metadata
		for _, field := range result.FieldDescriptions {
			columnNames = append(columnNames, field.Name)
			pqtype, ok := pgtype.NewMap().TypeForOID(field.DataTypeOID)
			if !ok {
				// Handle special cases for field types
				if field.DataTypeOID == pgtype.TimetzOID {
					columnTypesPGX = append(columnTypesPGX, "timetz")
				} else if field.DataTypeOID == 790 {
					columnTypesPGX = append(columnTypesPGX, "money")
				} else {
					return nil, fmt.Errorf("unknown data type oid: %d", field.DataTypeOID)
				}
			} else {
				columnTypesPGX = append(columnTypesPGX, pqtype.Name)
			}
		}
	}

	qm := &dataQueryModel{
		columnTypesPGX: columnTypesPGX,
		columnNames:    columnNames,
		timeIndex:      -1,
		timeEndIndex:   -1,
		metricIndex:    -1,
		metricPrefix:   false,
		queryContext:   queryContext,
	}

	queryJson := QueryJson{}
	err := json.Unmarshal(query.JSON, &queryJson)
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

		if qm.Format == dataQueryFormatTable && strings.EqualFold(col, "timeend") {
			qm.timeEndIndex = i
			continue
		}

		switch col {
		case "metric":
			qm.metricIndex = i
		default:
			if qm.metricIndex == -1 {
				columnType := qm.columnTypesPGX[i]
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

func convertResultsToFrame(results []*pgconn.Result, query string, rowLimit int64) (*data.Frame, error) {
	frame := data.Frame{}
	m := pgtype.NewMap()

	for _, result := range results {
		// Skip non-select statements
		if !result.CommandTag.Select() {
			continue
		}
		fieldDescriptions := result.FieldDescriptions
		fields := make(data.Fields, len(fieldDescriptions))

		fieldTypes, err := getFieldTypesFromDescriptions(fieldDescriptions, m)
		if err != nil {
			return nil, err
		}

		for i, v := range fieldDescriptions {
			fields[i] = data.NewFieldFromFieldType(fieldTypes[i], 0)
			fields[i].Name = v.Name
		}
		// Create a new frame
		frame = *data.NewFrame("", fields...)
	}

	//TODO: Add rowLimit

	// Add rows to the frame
	for _, result := range results {
		// Skip non-select statements
		if !result.CommandTag.Select() {
			continue
		}
		fieldDescriptions := result.FieldDescriptions
		for rowIdx := range result.Rows {
			if rowIdx == int(rowLimit) {
				frame.AppendNotices(data.Notice{
					Severity: data.NoticeSeverityWarning,
					Text:     fmt.Sprintf("Results have been limited to %v because the SQL row limit was reached", rowLimit),
				})
				break
			}
			row := make([]interface{}, len(fieldDescriptions))
			for colIdx, fd := range fieldDescriptions {
				rawValue := result.Rows[rowIdx][colIdx]
				dataTypeOID := fd.DataTypeOID
				format := fd.Format

				if rawValue == nil {
					row[colIdx] = nil
					continue
				}

				// Convert based on type
				switch fd.DataTypeOID {
				case pgtype.Int2OID:
					var d *int16
					scanPlan := m.PlanScan(dataTypeOID, format, &d)
					err := scanPlan.Scan(rawValue, &d)
					if err != nil {
						return nil, err
					}
					row[colIdx] = d
				case pgtype.Int4OID:
					var d *int32
					scanPlan := m.PlanScan(dataTypeOID, format, &d)
					err := scanPlan.Scan(rawValue, &d)
					if err != nil {
						return nil, err
					}
					row[colIdx] = d
				case pgtype.Int8OID:
					var d *int64
					scanPlan := m.PlanScan(dataTypeOID, format, &d)
					err := scanPlan.Scan(rawValue, &d)
					if err != nil {
						return nil, err
					}
					row[colIdx] = d
				case pgtype.NumericOID, pgtype.Float8OID, pgtype.Float4OID:
					var d *float64
					scanPlan := m.PlanScan(dataTypeOID, format, &d)
					err := scanPlan.Scan(rawValue, &d)
					if err != nil {
						return nil, err
					}
					row[colIdx] = d
				case pgtype.BoolOID:
					var d *bool
					scanPlan := m.PlanScan(dataTypeOID, format, &d)
					err := scanPlan.Scan(rawValue, &d)
					if err != nil {
						return nil, err
					}
					row[colIdx] = d
				case pgtype.ByteaOID:
					d, err := pgtype.ByteaCodec.DecodeValue(pgtype.ByteaCodec{}, m, dataTypeOID, format, rawValue)
					if err != nil {
						return nil, err
					}
					str := string(d.([]byte))
					row[colIdx] = &str
				case pgtype.TimestampOID, pgtype.TimestamptzOID, pgtype.DateOID:
					var d *time.Time
					scanPlan := m.PlanScan(dataTypeOID, format, &d)
					err := scanPlan.Scan(rawValue, &d)
					if err != nil {
						return nil, err
					}
					row[colIdx] = d
				case pgtype.TimeOID, pgtype.TimetzOID:
					var d *string
					scanPlan := m.PlanScan(dataTypeOID, format, &d)
					err := scanPlan.Scan(rawValue, &d)
					if err != nil {
						return nil, err
					}
					row[colIdx] = d
				default:
					var d *string
					scanPlan := m.PlanScan(dataTypeOID, format, &d)
					err := scanPlan.Scan(rawValue, &d)
					if err != nil {
						fmt.Println("error", err, "rawValue", rawValue, "dataTypeOID", dataTypeOID, "format", format)
						return nil, err
					}
					row[colIdx] = d
				}
			}
			frame.AppendRow(row...)
		}
	}

	return &frame, nil
}

func getFieldTypesFromDescriptions(fieldDescriptions []pgconn.FieldDescription, m *pgtype.Map) ([]data.FieldType, error) {
	fieldTypes := make([]data.FieldType, len(fieldDescriptions))
	for i, v := range fieldDescriptions {
		typeName, ok := m.TypeForOID(v.DataTypeOID)
		if !ok {
			// Handle special cases for field types
			if v.DataTypeOID == pgtype.TimetzOID || v.DataTypeOID == 790 {
				fieldTypes[i] = data.FieldTypeNullableString
			} else {
				return nil, fmt.Errorf("unknown data type oid: %d", v.DataTypeOID)
			}
		} else {
			switch typeName.Name {
			case "int2":
				fieldTypes[i] = data.FieldTypeNullableInt16
			case "int4":
				fieldTypes[i] = data.FieldTypeNullableInt32
			case "int8":
				fieldTypes[i] = data.FieldTypeNullableInt64
			case "float4", "float8", "numeric":
				fieldTypes[i] = data.FieldTypeNullableFloat64
			case "bool":
				fieldTypes[i] = data.FieldTypeNullableBool
			case "timestamptz", "timestamp", "date":
				fieldTypes[i] = data.FieldTypeNullableTime
			case "json", "jsonb":
				fieldTypes[i] = data.FieldTypeNullableJSON
			default:
				fieldTypes[i] = data.FieldTypeNullableString
			}
		}
	}
	return fieldTypes, nil
}
