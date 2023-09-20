package ml

import (
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	jsoniter "github.com/json-iterator/go"
)

type CommandConfiguration struct {
	Type       string              `json:"type"`
	IntervalMs *uint               `json:"intervalMs,omitempty"`
	Config     jsoniter.RawMessage `json:"config"`
}

type OutlierCommandConfiguration struct {
	DatasourceType string `json:"datasource_type"`
	DatasourceUID  string `json:"datasource_uid,omitempty"`

	// If Query is empty it should be contained in a datasource specific format
	// inside of QueryParms.
	Query       string         `json:"query,omitempty"`
	QueryParams map[string]any `json:"query_params,omitempty"`

	Algorithm    map[string]any `json:"algorithm"`
	ResponseType string         `json:"response_type"`
}

// outlierAttributes is outlier command configuration that is sent to Machine learning API
type outlierAttributes struct {
	OutlierCommandConfiguration
	GrafanaURL         string               `json:"grafana_url"`
	StartEndAttributes timeRangeAndInterval `json:"start_end_attributes"`
}

type outlierData struct {
	Attributes outlierAttributes `json:"attributes"`
}

// outlierRequestBody describes a request body that is sent to Outlier API
type outlierRequestBody struct {
	Data outlierData `json:"data"`
}

type timeRangeAndInterval struct {
	Start    mlTime `json:"start"`
	End      mlTime `json:"end"`
	Interval int64  `json:"interval"` // Interval is expected to be in milliseconds
}

func newTimeRangeAndInterval(from, to time.Time, interval time.Duration) timeRangeAndInterval {
	return timeRangeAndInterval{
		Start:    mlTime(from),
		End:      mlTime(to),
		Interval: interval.Milliseconds(),
	}
}

// mlTime is a time.Time that is marshalled as a string in a format is  supported by Machine Learning API
type mlTime time.Time

func (t *mlTime) UnmarshalJSON(b []byte) error {
	s := strings.Trim(string(b), "\"")
	parsed, err := time.Parse(timeFormat, s)
	if err != nil {
		return err
	}
	*t = mlTime(parsed)
	return nil
}

// MarshalJSON implements the Marshaler interface.
func (t mlTime) MarshalJSON() ([]byte, error) {
	return []byte("\"" + time.Time(t).Format(timeFormat) + "\""), nil
}

// outlierResponse is a model that represents a response of the outlier proxy API.
type outlierResponse struct {
	Status string                     `json:"status"`
	Data   *backend.QueryDataResponse `json:"data,omitempty"`
	Error  string                     `json:"error,omitempty"`
}
