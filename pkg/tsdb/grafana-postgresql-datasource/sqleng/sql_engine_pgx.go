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

	queryDataHandler.pool = p
	return &queryDataHandler, nil
}

func (e *DataSourceHandler) DisposePGX() {
	e.log.Debug("Disposing DB...")

	if e.pool != nil {
		e.pool.Close()
	}

	e.log.Debug("DB disposed")
}

func (e *DataSourceHandler) PingPGX(ctx context.Context) error {
	return e.pool.Ping(ctx)
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
		go e.executeQueryPGX(ctx, query, &wg, ch, queryjson)
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

func (e *DataSourceHandler) handleQueryError(frameErr string, err error, query string, source backend.ErrorSource, ch chan DBDataResponse, queryResult DBDataResponse) {
	var emptyFrame data.Frame
	emptyFrame.SetMeta(&data.FrameMeta{ExecutedQueryString: query})
	if backend.IsDownstreamError(err) {
		source = backend.ErrorSourceDownstream
	}
	queryResult.dataResponse.Error = fmt.Errorf("%s: %w", frameErr, err)
	queryResult.dataResponse.ErrorSource = source
	queryResult.dataResponse.Frames = data.Frames{&emptyFrame}
	ch <- queryResult
}

func (e *DataSourceHandler) handlePanic(logger log.Logger, queryResult *DBDataResponse, ch chan DBDataResponse) {
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
		ch <- *queryResult
	}
}

func (e *DataSourceHandler) execQuery(ctx context.Context, query string, logger log.Logger) ([]*pgconn.Result, error) {
	c, err := e.pool.Acquire(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to acquire connection: %w", err)
	}
	defer c.Release()

	mrr := c.Conn().PgConn().Exec(ctx, query)
	defer func() {
		if err := mrr.Close(); err != nil {
			logger.Warn("Failed to close multi-result reader", "error", err)
		}
	}()
	return mrr.ReadAll()
}

func (e *DataSourceHandler) executeQueryPGX(queryContext context.Context, query backend.DataQuery, wg *sync.WaitGroup,
	ch chan DBDataResponse, queryJSON QueryJson) {
	defer wg.Done()
	queryResult := DBDataResponse{
		dataResponse: backend.DataResponse{},
		refID:        query.RefID,
	}

	logger := e.log.FromContext(queryContext)
	defer e.handlePanic(logger, &queryResult, ch)

	if queryJSON.RawSql == "" {
		panic("Query model property rawSql should not be empty at this point")
	}

	// global substitutions
	interpolatedQuery := Interpolate(query, query.TimeRange, e.dsInfo.JsonData.TimeInterval, queryJSON.RawSql)

	// data source specific substitutions
	interpolatedQuery, err := e.macroEngine.Interpolate(&query, query.TimeRange, interpolatedQuery)
	if err != nil {
		e.handleQueryError("interpolation failed", e.TransformQueryError(logger, err), interpolatedQuery, backend.ErrorSourcePlugin, ch, queryResult)
		return
	}

	results, err := e.execQuery(queryContext, interpolatedQuery, logger)
	if err != nil {
		e.handleQueryError("db query error", e.TransformQueryError(logger, err), interpolatedQuery, backend.ErrorSourcePlugin, ch, queryResult)
		return
	}

	qm, err := e.newProcessCfgPGX(queryContext, query, results, interpolatedQuery)
	if err != nil {
		e.handleQueryError("failed to get configurations", err, interpolatedQuery, backend.ErrorSourcePlugin, ch, queryResult)
		return
	}

	frame, err := convertResultsToFrame(results, e.rowLimit)
	if err != nil {
		e.handleQueryError("convert frame from rows error", err, interpolatedQuery, backend.ErrorSourcePlugin, ch, queryResult)
		return
	}

	e.processFrame(frame, qm, queryResult, ch, logger)
}

func (e *DataSourceHandler) processFrame(frame *data.Frame, qm *dataQueryModel, queryResult DBDataResponse, ch chan DBDataResponse, logger log.Logger) {
	if frame.Meta == nil {
		frame.Meta = &data.FrameMeta{}
	}
	frame.Meta.ExecutedQueryString = qm.InterpolatedQuery

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
		e.handleQueryError("converting time columns failed", err, qm.InterpolatedQuery, backend.ErrorSourcePlugin, ch, queryResult)
		return
	}

	if qm.Format == dataQueryFormatSeries {
		// time series has to have time column
		if qm.timeIndex == -1 {
			e.handleQueryError("db has no time column", errors.New("time column is missing; make sure your data includes a time column for time series format or switch to a table format that doesn't require it"), qm.InterpolatedQuery, backend.ErrorSourceDownstream, ch, queryResult)
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
				e.handleQueryError("convert value to float failed", err, qm.InterpolatedQuery, backend.ErrorSourcePlugin, ch, queryResult)
				return
			}
		}

		tsSchema := frame.TimeSeriesSchema()
		if tsSchema.Type == data.TimeSeriesTypeLong {
			var err error
			originalData := frame
			frame, err = data.LongToWide(frame, qm.FillMissing)
			if err != nil {
				e.handleQueryError("failed to convert long to wide series when converting from dataframe", err, qm.InterpolatedQuery, backend.ErrorSourcePlugin, ch, queryResult)
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
				return
			}
		}
	}

	queryResult.dataResponse.Frames = data.Frames{frame}
	ch <- queryResult
}

func (e *DataSourceHandler) newProcessCfgPGX(queryContext context.Context, query backend.DataQuery,
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
				switch field.DataTypeOID {
				case pgtype.TimetzOID:
					columnTypesPGX = append(columnTypesPGX, "timetz")
				case 790:
					columnTypesPGX = append(columnTypesPGX, "money")
				default:
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

	queryJSON := QueryJson{}
	err := json.Unmarshal(query.JSON, &queryJSON)
	if err != nil {
		return nil, err
	}

	if queryJSON.Fill {
		qm.FillMissing = &data.FillMissing{}
		qm.Interval = time.Duration(queryJSON.FillInterval * float64(time.Second))
		switch strings.ToLower(queryJSON.FillMode) {
		case "null":
			qm.FillMissing.Mode = data.FillModeNull
		case "previous":
			qm.FillMissing.Mode = data.FillModePrevious
		case "value":
			qm.FillMissing.Mode = data.FillModeValue
			qm.FillMissing.Value = queryJSON.FillValue
		default:
		}
	}

	qm.TimeRange.From = query.TimeRange.From.UTC()
	qm.TimeRange.To = query.TimeRange.To.UTC()

	// Default to time_series if no format is provided
	switch queryJSON.Format {
	case "table":
		qm.Format = dataQueryFormatTable
	case "time_series":
		fallthrough
	default:
		qm.Format = dataQueryFormatSeries
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

func convertResultsToFrame(results []*pgconn.Result, rowLimit int64) (*data.Frame, error) {
	frame := data.Frame{}
	m := pgtype.NewMap()

	for _, result := range results {
		// Skip non-select statements
		if !result.CommandTag.Select() {
			continue
		}
		fields := make(data.Fields, len(result.FieldDescriptions))

		fieldTypes, err := getFieldTypesFromDescriptions(result.FieldDescriptions, m)
		if err != nil {
			return nil, err
		}

		for i, v := range result.FieldDescriptions {
			fields[i] = data.NewFieldFromFieldType(fieldTypes[i], 0)
			fields[i].Name = v.Name
		}
		// Create a new frame
		frame = *data.NewFrame("", fields...)
	}

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
