package tsdb

import (
	"encoding/base64"
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	jsoniter "github.com/json-iterator/go"
)

// TsdbQuery contains all information about a query request.
type TsdbQuery struct {
	TimeRange *TimeRange
	Queries   []*Query
	Headers   map[string]string
	Debug     bool
	User      *models.SignedInUser
}

type Query struct {
	RefId         string             `json:"refId"`
	Model         *simplejson.Json   `json:"model,omitempty"`
	DataSource    *models.DataSource `json:"datasource"`
	MaxDataPoints int64              `json:"maxDataPoints"`
	IntervalMs    int64              `json:"intervalMs"`
	QueryType     string             `json:"queryType"`
}

type Response struct {
	Results map[string]*QueryResult `json:"results"`
	Message string                  `json:"message,omitempty"`
}

type QueryResult struct {
	Error       error            `json:"-"`
	ErrorString string           `json:"error,omitempty"`
	RefId       string           `json:"refId"`
	Meta        *simplejson.Json `json:"meta,omitempty"`
	Series      TimeSeriesSlice  `json:"series"`
	Tables      []*Table         `json:"tables"`
	Dataframes  DataFrames       `json:"dataframes"`
}

// UnmarshalJSON deserializes a QueryResult from JSON.
//
// Deserialization support is required by tests.
func (r *QueryResult) UnmarshalJSON(b []byte) error {
	m := map[string]interface{}{}
	// TODO: Use JSON decoder
	if err := json.Unmarshal(b, &m); err != nil {
		return err
	}

	refID, ok := m["refId"].(string)
	if !ok {
		return fmt.Errorf("can't decode field refId - not a string")
	}
	var meta *simplejson.Json
	if m["meta"] != nil {
		mm, ok := m["meta"].(map[string]interface{})
		if !ok {
			return fmt.Errorf("can't decode field meta - not a JSON object")
		}
		meta = simplejson.NewFromAny(mm)
	}
	var series TimeSeriesSlice
	/* TODO
	if m["series"] != nil {
	}
	*/
	var tables []*Table
	if m["tables"] != nil {
		ts, ok := m["tables"].([]interface{})
		if !ok {
			return fmt.Errorf("can't decode field tables - not an array of Tables")
		}
		for _, ti := range ts {
			tm, ok := ti.(map[string]interface{})
			if !ok {
				return fmt.Errorf("can't decode field tables - not an array of Tables")
			}
			var columns []TableColumn
			cs, ok := tm["columns"].([]interface{})
			if !ok {
				return fmt.Errorf("can't decode field tables - not an array of Tables")
			}
			for _, ci := range cs {
				cm, ok := ci.(map[string]interface{})
				if !ok {
					return fmt.Errorf("can't decode field tables - not an array of Tables")
				}
				val, ok := cm["text"].(string)
				if !ok {
					return fmt.Errorf("can't decode field tables - not an array of Tables")
				}

				columns = append(columns, TableColumn{Text: val})
			}

			rs, ok := tm["rows"].([]interface{})
			if !ok {
				return fmt.Errorf("can't decode field tables - not an array of Tables")
			}
			var rows []RowValues
			for _, ri := range rs {
				vals, ok := ri.([]interface{})
				if !ok {
					return fmt.Errorf("can't decode field tables - not an array of Tables")
				}
				rows = append(rows, vals)
			}

			tables = append(tables, &Table{
				Columns: columns,
				Rows:    rows,
			})
		}
	}

	var dfs *dataFrames
	if m["dataframes"] != nil {
		raw, ok := m["dataframes"].([]interface{})
		if !ok {
			return fmt.Errorf("can't decode field dataframes - not an array of byte arrays")
		}

		var encoded [][]byte
		for _, ra := range raw {
			encS, ok := ra.(string)
			if !ok {
				return fmt.Errorf("can't decode field dataframes - not an array of byte arrays")
			}
			enc, err := base64.StdEncoding.DecodeString(encS)
			if err != nil {
				return fmt.Errorf("can't decode field dataframes - not an array of arrow frames")
			}
			encoded = append(encoded, enc)
		}
		decoded, err := data.UnmarshalArrowFrames(encoded)
		if err != nil {
			return err
		}
		dfs = &dataFrames{
			decoded: decoded,
			encoded: encoded,
		}
	}

	r.RefId = refID
	r.Meta = meta
	r.Series = series
	r.Tables = tables
	if dfs != nil {
		r.Dataframes = dfs
	}
	return nil
}

type TimeSeries struct {
	Name   string            `json:"name"`
	Points TimeSeriesPoints  `json:"points"`
	Tags   map[string]string `json:"tags,omitempty"`
}

type Table struct {
	Columns []TableColumn `json:"columns"`
	Rows    []RowValues   `json:"rows"`
}

type TableColumn struct {
	Text string `json:"text"`
}

type RowValues []interface{}
type TimePoint [2]null.Float
type TimeSeriesPoints []TimePoint
type TimeSeriesSlice []*TimeSeries

func NewQueryResult() *QueryResult {
	return &QueryResult{
		Series: make(TimeSeriesSlice, 0),
	}
}

func NewTimePoint(value null.Float, timestamp float64) TimePoint {
	return TimePoint{value, null.FloatFrom(timestamp)}
}

// DataFrames is an interface for retrieving encoded and decoded data frames.
//
// See NewDecodedDataFrames and NewEncodedDataFrames for more information.
type DataFrames interface {
	// Encoded encodes Frames into a slice of []byte.
	// If an error occurs [][]byte will be nil.
	// The encoded result, if any, will be cached and returned next time Encoded is called.
	Encoded() ([][]byte, error)

	// Decoded decodes a slice of Arrow encoded frames to data.Frames ([]*data.Frame).
	// If an error occurs Frames will be nil.
	// The decoded result, if any, will be cached and returned next time Decoded is called.
	Decoded() (data.Frames, error)
}

type dataFrames struct {
	decoded data.Frames
	encoded [][]byte
}

// NewDecodedDataFrames instantiates DataFrames from decoded frames.
//
// This should be the primary function for creating DataFrames if you're implementing a plugin.
// In a Grafana alerting scenario it needs to operate on decoded frames, which is why this function is
// preferrable. When encoded data frames are needed, e.g. returned from Grafana HTTP API, it will
// happen automatically when MarshalJSON() is called.
func NewDecodedDataFrames(decodedFrames data.Frames) DataFrames {
	return &dataFrames{
		decoded: decodedFrames,
	}
}

// NewEncodedDataFrames instantiates DataFrames from encoded frames.
//
// This one is primarily used for creating DataFrames when receiving encoded data frames from an external
// plugin or similar. This may allow the encoded data frames to be returned to Grafana UI without any additional
// decoding/encoding required. In Grafana alerting scenario it needs to operate on decoded data frames why encoded
// frames needs to be decoded before usage.
func NewEncodedDataFrames(encodedFrames [][]byte) DataFrames {
	return &dataFrames{
		encoded: encodedFrames,
	}
}

func (df *dataFrames) Encoded() ([][]byte, error) {
	if df.encoded == nil {
		encoded, err := df.decoded.MarshalArrow()
		if err != nil {
			return nil, err
		}
		df.encoded = encoded
	}

	return df.encoded, nil
}

func (df *dataFrames) Decoded() (data.Frames, error) {
	if df.decoded == nil {
		decoded, err := data.UnmarshalArrowFrames(df.encoded)
		if err != nil {
			return nil, err
		}
		df.decoded = decoded
	}

	return df.decoded, nil
}

func (df *dataFrames) MarshalJSON() ([]byte, error) {
	encoded, err := df.Encoded()
	if err != nil {
		return nil, err
	}

	// Use a configuration that's compatible with the standard library
	// to minimize the risk of introducing bugs. This will make sure
	// that map keys is ordered.
	jsonCfg := jsoniter.ConfigCompatibleWithStandardLibrary
	return jsonCfg.Marshal(encoded)
}
