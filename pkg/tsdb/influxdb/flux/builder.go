package flux

import (
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	influxdb2 "github.com/influxdata/influxdb-client-go"
)

// Copied from: (Apache 2 license)
// https://github.com/influxdata/influxdb-client-go/blob/master/query.go#L30
const (
	stringDatatype       = "string"
	doubleDatatype       = "double"
	boolDatatype         = "bool"
	longDatatype         = "long"
	uLongDatatype        = "unsignedLong"
	durationDatatype     = "duration"
	base64BinaryDataType = "base64Binary"
	timeDatatypeRFC      = "dateTime:RFC3339"
	timeDatatypeRFCNano  = "dateTime:RFC3339Nano"
)

type columnInfo struct {
	name      string
	converter *data.FieldConverter
}

// This is an interface to help testing
type FrameBuilder struct {
	tableId      int64
	active       *data.Frame
	frames       []*data.Frame
	value        *data.FieldConverter
	columns      []columnInfo
	labels       []string
	maxPoints    int // max points in a series
	maxSeries    int // max number of series
	totalSeries  int
	isTimeSeries bool
}

func isTag(schk string) bool {
	return (schk != "result" && schk != "table" && schk[0] != '_')
}

func getConverter(t string) (*data.FieldConverter, error) {
	switch t {
	case stringDatatype:
		return &AnyToOptionalString, nil
	case timeDatatypeRFC:
		return &Int64ToOptionalInt64, nil
	case timeDatatypeRFCNano:
		return &Int64ToOptionalInt64, nil
	case durationDatatype:
		return &Int64ToOptionalInt64, nil
	case doubleDatatype:
		return &Float64ToOptionalFloat64, nil
	case boolDatatype:
		return &BoolToOptionalBool, nil
	case longDatatype:
		return &Int64ToOptionalInt64, nil
	case uLongDatatype:
		return &UInt64ToOptionalUInt64, nil
	case base64BinaryDataType:
		return &AnyToOptionalString, nil
	}

	return nil, fmt.Errorf("No matching converter found for [%v]", t)
}

// Init initializes the frame to be returned
// fields points at entries in the frame, and provides easier access
// names indexes the columns encountered
func (fb *FrameBuilder) Init(metadata *influxdb2.FluxTableMetadata) error {
	columns := metadata.Columns()
	fb.frames = make([]*data.Frame, 0)
	fb.tableId = -1
	fb.value = nil
	fb.columns = make([]columnInfo, 0)
	fb.isTimeSeries = false

	for _, col := range columns {
		switch {
		case col.Name() == "_value":
			if fb.value != nil {
				return fmt.Errorf("multiple values found")
			}
			converter, err := getConverter(col.DataType())
			if err != nil {
				return err
			}
			fb.value = converter
		case col.Name() == "_measurement":
			fb.isTimeSeries = true
		case isTag(col.Name()):
			fb.labels = append(fb.labels, col.Name())
		}
	}

	if !fb.isTimeSeries {
		fb.labels = make([]string, 0)
		for _, col := range columns {
			converter, err := getConverter(col.DataType())
			if err != nil {
				return err
			}
			fb.columns = append(fb.columns, columnInfo{
				name:      col.Name(),
				converter: converter,
			})
		}
	}

	return nil
}

// Append appends a single entry from an influxdb2 record to a data frame
// Values are appended to _value
// Tags are appended as labels
// _measurement holds the dataframe name
// _field holds the field name.
func (fb *FrameBuilder) Append(record *influxdb2.FluxRecord) error {
	table, ok := record.ValueByKey("table").(int64)
	if ok && table != fb.tableId {
		fb.totalSeries++
		if fb.totalSeries > fb.maxSeries {
			return fmt.Errorf("reached max series limit (%d)", fb.maxSeries)
		}

		if fb.isTimeSeries {
			// Series Data
			labels := make(map[string]string)
			for _, name := range fb.labels {
				labels[name] = record.ValueByKey(name).(string)
			}
			fb.active = data.NewFrame(
				record.Measurement(),
				data.NewFieldFromFieldType(data.FieldTypeTime, 0),
				data.NewFieldFromFieldType(fb.value.OutputFieldType, 0),
			)

			fb.active.Fields[0].Name = "Time"
			fb.active.Fields[1].Name = record.Field()
			fb.active.Fields[1].Labels = labels
		} else {
			fields := make([]*data.Field, len(fb.columns))
			for idx, col := range fb.columns {
				fields[idx] = data.NewFieldFromFieldType(col.converter.OutputFieldType, 0)
				fields[idx].Name = col.name
			}
			fb.active = data.NewFrame("", fields...)
		}

		fb.frames = append(fb.frames, fb.active)
		fb.tableId = table
	}

	if fb.isTimeSeries {
		val, err := fb.value.Converter(record.Value())
		if err != nil {
			return err
		}
		fb.active.Fields[0].Append(record.Time())
		fb.active.Fields[1].Append(val)
	} else {
		// Table view
		for idx, col := range fb.columns {
			val, err := col.converter.Converter(record.ValueByKey(col.name))
			if err != nil {
				return err
			}
			fb.active.Fields[idx].Append(val)
		}
	}

	if fb.active.Fields[0].Len() > fb.maxPoints {
		return fmt.Errorf("returned too many points in a series: %d", fb.maxPoints)
	}

	return nil
}
