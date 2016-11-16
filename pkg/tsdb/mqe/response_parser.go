package mqe

import (
	"encoding/json"
	"io/ioutil"
	"net/http"
	"time"

	null "gopkg.in/guregu/null.v3"

	"fmt"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/tsdb"
)

// wildcard as alias
// add host to alias
// add app to alias
// regular alias

func NewResponseParser() *MQEResponseParser {
	return &MQEResponseParser{
		log: log.New("tsdb.mqe"),
	}
}

type MQEResponse struct {
	Success bool               `json:"success"`
	Name    string             `json:"name"`
	Body    []MQEResponseSerie `json:"body"`
}

type ResponseTimeRange struct {
	Start      int64         `json:"start"`
	End        int64         `json:"end"`
	Resolution time.Duration `json:"Resolution"`
}

type MQEResponseSerie struct {
	Query     string            `json:"query"`
	Name      string            `json:"name"`
	Type      string            `json:"type"`
	Series    []MQESerie        `json:"series"`
	TimeRange ResponseTimeRange `json:"timerange"`
}

type MQESerie struct {
	Values []null.Float      `json:"values"`
	Tagset map[string]string `json:"tagset"`
}

type MQEResponseParser struct {
	log log.Logger
}

func (parser *MQEResponseParser) Parse(res *http.Response) (*tsdb.QueryResult, error) {
	body, err := ioutil.ReadAll(res.Body)
	defer res.Body.Close()
	if err != nil {
		return nil, err
	}

	if res.StatusCode/100 != 2 {
		parser.log.Error("Request failed", "status code", res.StatusCode, "body", string(body))
		return nil, fmt.Errorf("Returned invalid statuscode")
	}

	var data *MQEResponse = &MQEResponse{}
	err = json.Unmarshal(body, data)
	if err != nil {
		parser.log.Info("Failed to unmarshal graphite response", "error", err, "status", res.Status, "body", string(body))
		return nil, err
	}

	if !data.Success {
		return nil, fmt.Errorf("MQE request failed.")
	}

	var series tsdb.TimeSeriesSlice
	for _, v := range data.Body {
		for _, k := range v.Series {
			serie := &tsdb.TimeSeries{
				Name: v.Name,
			}

			startTime := time.Unix(v.TimeRange.Start*1000, 0)
			for i, l := range k.Values {
				timestamp := startTime.Add(time.Duration(int64(v.TimeRange.Resolution) * int64(i)))
				serie.Points = append(serie.Points, tsdb.NewTimePoint(l, float64(timestamp.UnixNano()/int64(time.Millisecond))))
			}

			series = append(series, serie)
		}

	}

	return &tsdb.QueryResult{Series: series}, nil
}
