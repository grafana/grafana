package flux

import (
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/data/converters"
	"github.com/influxdata/influxdb-client-go/v2/api/query"
)

// based on https://docs.influxdata.com/influxdb/v2.0/reference/syntax/annotated-csv/#data-types
const (
	stringDatatype             = "string"
	doubleDatatype             = "double"
	booleanDatatype            = "boolean"
	longDatatype               = "long"
	unsignedLongDatatype       = "unsignedLong"
	durationDatatype           = "duration"
	base64BinaryDataType       = "base64Binary"
	datetimeRFC339DataType     = "dateTime:RFC3339"
	datetimeRFC339DataTypeNano = "dateTime:RFC3339Nano"
	// based on the documentation there should also be "dateTime:number" but i have never seen it yet.
)

// the general approach to process the influxdb response is:
// - for columns with data, we convert them to grafana dataframes
// - for columns with tags, we convert them to labels for the dataframes
//
// we also try to detect some often used patterns in the data,
// and make the data easier to graph in the browser for such cases:
//   - if there is only one timestamp-column and it's named "_time",
//     we will not add the labels to this data-column, because timestamp
//     columns usually do not have labels in grafana.
//     we use the `columnInfo.shouldGetLabels` attribute to handle this.
//   - if there is only one timestamp-column and it's named "_time",
//     and there is only one non-timestamp-column and it's named "_value",
//     we rename "_time" to "Time" (using `columnInfo.isTheSimpleTime`),
//     and we rename "_value" too (using `columnInfo.isTheSimpleValue`):
//     if there is a tag called "_field" we use it's value as the name
//     (because that's the usual approach in influxdb), and if there is not,
//     we name it "Value". with these new names, they are more compatible
//     with the visualizations in grafana.
type columnInfo struct {
	name             string
	converter        *data.FieldConverter
	shouldGetLabels  bool
	isTheSimpleValue bool
	isTheSimpleTime  bool
}

// frameBuilder is an interface to help testing.
type frameBuilder struct {
	currentGroupKey     []interface{}
	groupKeyColumnNames []string
	active              *data.Frame
	frames              []*data.Frame
	columns             []columnInfo
	labels              []string
	maxPoints           int // max points in a series
	maxSeries           int // max number of series
	totalSeries         int
	hasUsualStartStop   bool // has _start and _stop timestamp-labels
}

// some csv-columns contain metadata about the data, like what is part of a "table",
// we skip these
func isDataColumn(col *query.FluxColumn) bool {
	index := col.Index()
	name := col.Name()
	dataType := col.DataType()
	if index == 0 && name == "result" && dataType == stringDatatype {
		return false
	}
	if index == 1 && name == "table" && dataType == longDatatype {
		return false
	}

	return true
}

func getDataColumns(cols []*query.FluxColumn) []*query.FluxColumn {
	var dataCols []*query.FluxColumn

	for _, col := range cols {
		if isDataColumn(col) {
			dataCols = append(dataCols, col)
		}
	}

	return dataCols
}

var timeToOptionalTime = data.FieldConverter{
	OutputFieldType: data.FieldTypeNullableTime,
	Converter: func(v interface{}) (interface{}, error) {
		var ptr *time.Time
		if v == nil {
			return ptr, nil
		}
		val, ok := v.(time.Time)
		if !ok {
			return ptr, fmt.Errorf(`expected %s input but got type %T for value "%v"`, "time.Time", v, v)
		}
		ptr = &val
		return ptr, nil
	},
}

func getConverter(t string) (*data.FieldConverter, error) {
	switch t {
	case stringDatatype:
		return &converters.AnyToNullableString, nil
	case datetimeRFC339DataType:
		return &timeToOptionalTime, nil
	case datetimeRFC339DataTypeNano:
		return &timeToOptionalTime, nil
	case durationDatatype:
		return &converters.Int64ToNullableInt64, nil
	case doubleDatatype:
		return &converters.Float64ToNullableFloat64, nil
	case booleanDatatype:
		return &converters.BoolToNullableBool, nil
	case longDatatype:
		return &converters.Int64ToNullableInt64, nil
	case unsignedLongDatatype:
		return &converters.Uint64ToNullableUInt64, nil
	case base64BinaryDataType:
		return &converters.AnyToNullableString, nil
	}

	return nil, fmt.Errorf("no matching converter found for [%v]", t)
}

func getGroupColumnNames(cols []*query.FluxColumn) []string {
	var colNames []string
	for _, col := range cols {
		if col.IsGroup() {
			colNames = append(colNames, col.Name())
		}
	}

	return colNames
}

func isTimestampType(dataType string) bool {
	return (dataType == datetimeRFC339DataType) || (dataType == datetimeRFC339DataTypeNano)
}

func hasUsualStartStop(dataCols []*query.FluxColumn) bool {
	starts := 0
	stops := 0

	for _, col := range dataCols {
		if col.IsGroup() && isTimestampType(col.DataType()) {
			name := col.Name()
			if name == "_start" {
				starts += 1
			}
			if name == "_stop" {
				stops += 1
			}
		}
	}

	return (starts == 1) && (stops == 1)
}

func (fb *frameBuilder) Init(metadata *query.FluxTableMetadata) error {
	columns := metadata.Columns()
	// FIXME: the following line should very probably simply be
	// `fb.frames = nil`, but in executor.go there is an explicit
	// check to make sure it is not `nil`, so that check should be
	// removed too, and double-checked if everything is ok.
	fb.frames = make([]*data.Frame, 0)
	fb.currentGroupKey = nil
	fb.columns = nil
	fb.labels = nil
	fb.groupKeyColumnNames = getGroupColumnNames(columns)
	fb.active = nil
	fb.hasUsualStartStop = false

	var timestampCols []*columnInfo
	var nonTimestampCols []*columnInfo

	dataColumns := getDataColumns(columns)
	fb.hasUsualStartStop = hasUsualStartStop(dataColumns)

	for _, col := range dataColumns {
		if col.IsGroup() {
			fb.labels = append(fb.labels, col.Name())
		} else {
			dataType := col.DataType()
			name := col.Name()
			isTimestamp := isTimestampType(dataType)

			converter, err := getConverter(dataType)
			if err != nil {
				return err
			}

			info := &columnInfo{
				name:             name,
				converter:        converter,
				shouldGetLabels:  true, // we default to get-labels
				isTheSimpleValue: false,
				isTheSimpleTime:  false,
			}

			if isTimestamp {
				timestampCols = append(timestampCols, info)
			} else {
				nonTimestampCols = append(nonTimestampCols, info)
			}
		}
	}

	hasSimpleTimeCol := false
	if (len(timestampCols) == 1) && (timestampCols[0].name == "_time") {
		// there is only one timestamp-data-column, and has the correct name.
		// based on this info, we decide that this is "the" timestamp-column.
		// as such it gets no label
		timestampCols[0].shouldGetLabels = false
		hasSimpleTimeCol = true
	}

	if hasSimpleTimeCol && (len(nonTimestampCols) == 1) && (nonTimestampCols[0].name == "_value") {
		// there is a simple timestamp column, and there is a single non-timestamp value column
		// named "_value". we decide that this is "the" value-column.
		nonTimestampCols[0].isTheSimpleValue = true

		// now that we know that there is both a single correctly named timestamp column
		// and a single correctly named value column, we mark the timestamp column as THE timestamp
		timestampCols[0].isTheSimpleTime = true
	}

	// grafana wants the timestamp columns first, so we add them first
	for _, colInfo := range timestampCols {
		fb.columns = append(fb.columns, *colInfo)
	}
	// then we add the non-timestamp-columns
	for _, colInfo := range nonTimestampCols {
		fb.columns = append(fb.columns, *colInfo)
	}

	return nil
}

type maxPointsExceededError struct {
	Count int
}

func (e maxPointsExceededError) Error() string {
	return fmt.Sprintf("max data points limit exceeded (count is %d)", e.Count)
}

func getTableID(record *query.FluxRecord, groupColumns []string) []interface{} {
	result := make([]interface{}, len(groupColumns))

	// Flux does not allow duplicate column-names,
	// so we can be sure there is no confusion in the record.
	//
	// ( it does allow for a column named "table" to exist,
	// and shadow the table-id "table" column, but the potentially
	// shadowed table-id column is not a part of the group-key,
	// so we should be safe )

	for i, colName := range groupColumns {
		result[i] = record.ValueByKey(colName)
	}

	return result
}

func isTableIDEqual(id1 []interface{}, id2 []interface{}) bool {
	if (id1 == nil) || (id2 == nil) {
		return false
	}

	if len(id1) != len(id2) {
		return false
	}

	for i, id1Val := range id1 {
		id2Val := id2[i]

		if id1Val != id2Val {
			return false
		}
	}

	return true
}

func (fb *frameBuilder) Append(record *query.FluxRecord) error {
	table := getTableID(record, fb.groupKeyColumnNames)
	if (fb.currentGroupKey == nil) || !isTableIDEqual(table, fb.currentGroupKey) {
		fb.totalSeries++
		if fb.totalSeries > fb.maxSeries {
			return fmt.Errorf("results are truncated, max series reached (%d)", fb.maxSeries)
		}

		// labels have the same value for every row in the same "table",
		// so we collect them here
		labels := make(map[string]string)
		for _, name := range fb.labels {
			val := record.ValueByKey(name)
			str := fmt.Sprintf("%v", val)
			if val != nil && str != "" {
				labels[name] = str
			}
		}

		// we will try to use the _measurement label as the frame-name.
		// if it works, we remove _measurement from the labels.
		frameName := ""
		measurementLabel := labels["_measurement"]
		if measurementLabel != "" {
			frameName = measurementLabel
			delete(labels, "_measurement")
		}

		fields := make([]*data.Field, len(fb.columns))
		for idx, col := range fb.columns {
			fields[idx] = data.NewFieldFromFieldType(col.converter.OutputFieldType, 0)
			fields[idx].Name = col.name

			if col.isTheSimpleTime {
				// the standard name for the timestamp column
				// in grafana is `Time`. in this simple-case we will
				// use that name. this should improve
				// compatibility with the ui-components
				fields[idx].Name = "Time"
			}

			if col.isTheSimpleValue {
				fieldLabel := labels["_field"]
				if fieldLabel != "" {
					fields[idx].Name = fieldLabel
					delete(labels, "_field")
				} else {
					// the standard name for the value column
					// in grafana is `Value`. in this simple-case we will
					// use that name. this should improve
					// compatibility with the ui-components
					fields[idx].Name = "Value"
				}
			}

			if col.isTheSimpleTime || col.isTheSimpleValue {
				// when the data-structure is "simple"
				// (meaning simple-time and simple-value),
				// we remove the "_start" and "_stop"
				// labels if they are the usual type,
				// because they are usually not wanted,
				// because they are the start and stop
				// of the time-interval.

				if fb.hasUsualStartStop {
					delete(labels, "_start")
					delete(labels, "_stop")
				}
			}

			if col.shouldGetLabels {
				fields[idx].Labels = labels
			}
		}
		fb.active = data.NewFrame(frameName, fields...)

		fb.frames = append(fb.frames, fb.active)
		fb.currentGroupKey = table
	}

	for idx, col := range fb.columns {
		val, err := col.converter.Converter(record.ValueByKey(col.name))
		if err != nil {
			return err
		}

		fb.active.Fields[idx].Append(val)
	}

	pointsCount := fb.active.Fields[0].Len()
	if pointsCount > fb.maxPoints {
		return maxPointsExceededError{Count: pointsCount}
	}

	return nil
}
