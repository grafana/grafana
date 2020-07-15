package flux

import (
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/influxdata/influxdb-client-go/api/query"
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

// FrameBuilder This is an interface to help testing
type FrameBuilder struct {
	tableID      int64
	active       *data.Frame
	frames       []*data.Frame
	value        *data.FieldConverter
	columns      []columnInfo
	labels       []string
	maxPoints    int // max points in a series
	maxSeries    int // max number of series
	totalSeries  int
	isTimeSeries bool
	timeColumn   string // sometimes it is not `_time`
	timeDisplay  string
}

func isTag(schk string) bool {
	return (schk != "result" && schk != "table" && schk[0] != '_')
}

func getConverter(t string) (*data.FieldConverter, error) {
	switch t {
	case stringDatatype:
		return &AnyToOptionalString, nil
	case timeDatatypeRFC:
		return &TimeToOptionalTime, nil
	case timeDatatypeRFCNano:
		return &TimeToOptionalTime, nil
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
func (fb *FrameBuilder) Init(metadata *query.FluxTableMetadata) error {
	columns := metadata.Columns()
	fb.frames = make([]*data.Frame, 0)
	fb.tableID = -1
	fb.value = nil
	fb.columns = make([]columnInfo, 0)
	fb.isTimeSeries = false
	fb.timeColumn = ""

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
			fb.isTimeSeries = true
		case isTag(col.Name()):
			fb.labels = append(fb.labels, col.Name())
		}
	}

	if fb.isTimeSeries {
		col := getTimeSeriesTimeColumn(columns)
		if col == nil {
			return fmt.Errorf("no time column in timeSeries")
		}
		fb.timeColumn = col.Name()
		fb.timeDisplay = "Time"
		if "_time" != fb.timeColumn {
			fb.timeDisplay = col.Name()
		}
	} else {
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

func getTimeSeriesTimeColumn(columns []*query.FluxColumn) *query.FluxColumn {
	// First look for '_time' column
	for _, col := range columns {
		if col.Name() == "_time" && col.DataType() == timeDatatypeRFC || col.DataType() == timeDatatypeRFCNano {
			return col
		}
	}

	// Then any time column
	for _, col := range columns {
		if col.DataType() == timeDatatypeRFC || col.DataType() == timeDatatypeRFCNano {
			return col
		}
	}
	return nil
}

// Append appends a single entry from an influxdb2 record to a data frame
// Values are appended to _value
// Tags are appended as labels
// _measurement holds the dataframe name
// _field holds the field name.
func (fb *FrameBuilder) Append(record *query.FluxRecord) error {
	table, ok := record.ValueByKey("table").(int64)
	if ok && table != fb.tableID {
		fb.totalSeries++
		if fb.totalSeries > fb.maxSeries {
			return fmt.Errorf("reached max series limit (%d)", fb.maxSeries)
		}

		if fb.isTimeSeries {
			frameName, ok := record.ValueByKey("_measurement").(string)
			if !ok {
				frameName = "" // empty frame name
			}

			fb.active = data.NewFrame(
				frameName,
				data.NewFieldFromFieldType(data.FieldTypeTime, 0),
				data.NewFieldFromFieldType(fb.value.OutputFieldType, 0),
			)

			fb.active.Fields[0].Name = fb.timeDisplay
			name, ok := record.ValueByKey("_field").(string)
			if ok {
				fb.active.Fields[1].Name = name
			}

			// set the labels
			labels := make(map[string]string)
			for _, name := range fb.labels {
				val, ok := record.ValueByKey(name).(string)
				if ok {
					labels[name] = val
				}
			}
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
		fb.tableID = table
	}

	if fb.isTimeSeries {
		time, ok := record.ValueByKey(fb.timeColumn).(time.Time)
		if !ok {
			return fmt.Errorf("unable to get time colum: %s", fb.timeColumn)
		}

		val, err := fb.value.Converter(record.Value())
		if err != nil {
			return err
		}
		fb.active.Fields[0].Append(time)
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
