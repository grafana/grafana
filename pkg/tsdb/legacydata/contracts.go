package legacydata

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/user"
)

// RequestHandler is a data request handler interface.
// Deprecated: use backend.QueryDataHandler instead.
type RequestHandler interface {
	// HandleRequest handles a data request.
	HandleRequest(context.Context, *datasources.DataSource, DataQuery) (DataResponse, error)
}

// DataSubQuery represents a data sub-query.  New work should use the plugin SDK.
type DataSubQuery struct {
	RefID         string                  `json:"refId"`
	Model         *simplejson.Json        `json:"model,omitempty"`
	DataSource    *datasources.DataSource `json:"datasource"`
	MaxDataPoints int64                   `json:"maxDataPoints"`
	IntervalMS    int64                   `json:"intervalMs"`
	QueryType     string                  `json:"queryType"`
}

// DataQuery contains all information about a data query request.  New work should use the plugin SDK.
type DataQuery struct {
	TimeRange *DataTimeRange
	Queries   []DataSubQuery
	Headers   map[string]string
	Debug     bool
	User      *user.SignedInUser
}

type DataTable struct {
	Columns []DataTableColumn `json:"columns"`
	Rows    []DataRowValues   `json:"rows"`
}

type DataTableColumn struct {
	Text string `json:"text"`
}

type DataTimePoint [2]null.Float
type DataTimeSeriesPoints []DataTimePoint
type DataTimeSeriesSlice []DataTimeSeries
type DataRowValues []interface{}

// Deprecated: DataQueryResult should use backend.QueryDataResponse
type DataQueryResult struct {
	Error       error               `json:"-"`
	ErrorString string              `json:"error,omitempty"`
	RefID       string              `json:"refId"`
	Meta        *simplejson.Json    `json:"meta,omitempty"`
	Series      DataTimeSeriesSlice `json:"series"`
	Tables      []DataTable         `json:"tables"`
	Dataframes  DataFrames          `json:"dataframes"`
}

// UnmarshalJSON deserializes a DataQueryResult from JSON.
//
// Deserialization support is required by tests.
func (r *DataQueryResult) UnmarshalJSON(b []byte) error {
	m := map[string]interface{}{}
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
	var series DataTimeSeriesSlice
	/* TODO
	if m["series"] != nil {
	}
	*/
	var tables []DataTable
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
			var columns []DataTableColumn
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

				columns = append(columns, DataTableColumn{Text: val})
			}

			rs, ok := tm["rows"].([]interface{})
			if !ok {
				return fmt.Errorf("can't decode field tables - not an array of Tables")
			}
			var rows []DataRowValues
			for _, ri := range rs {
				vals, ok := ri.([]interface{})
				if !ok {
					return fmt.Errorf("can't decode field tables - not an array of Tables")
				}
				rows = append(rows, vals)
			}

			tables = append(tables, DataTable{
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

	r.RefID = refID
	r.Meta = meta
	r.Series = series
	r.Tables = tables
	if dfs != nil {
		r.Dataframes = dfs
	}
	return nil
}

// DataTimeSeries -- this structure is deprecated, all new work should use DataFrames from the SDK
type DataTimeSeries struct {
	Name   string               `json:"name"`
	Points DataTimeSeriesPoints `json:"points"`
	Tags   map[string]string    `json:"tags,omitempty"`
}

// Deprecated: DataResponse -- this structure is deprecated, all new work should use backend.QueryDataResponse
type DataResponse struct {
	Results map[string]DataQueryResult `json:"results"`
	Message string                     `json:"message,omitempty"`
}
