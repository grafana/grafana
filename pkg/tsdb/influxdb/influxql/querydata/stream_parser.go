package querydata

import (
	"fmt"
	"io"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	jsoniter "github.com/json-iterator/go"

	"github.com/grafana/grafana/pkg/tsdb/influxdb/influxql/converter"
	"github.com/grafana/grafana/pkg/tsdb/influxdb/influxql/util"
	"github.com/grafana/grafana/pkg/tsdb/influxdb/models"
)

func ResponseParse(buf io.ReadCloser, statusCode int, query *models.Query) *backend.DataResponse {
	defer func() {
		if err := buf.Close(); err != nil {
			fmt.Println("Failed to close response body", "err", err)
		}
	}()

	iter := jsoniter.Parse(jsoniter.ConfigDefault, buf, 1024)
	r := converter.ReadInfluxQLStyleResult(iter, query)

	if statusCode/100 != 2 {
		return &backend.DataResponse{
			Error:       fmt.Errorf("InfluxDB returned error: %s", r.Error),
			ErrorSource: backend.ErrorSourceFromHTTPStatus(statusCode),
		}
	}

	// The ExecutedQueryString can be viewed in QueryInspector in UI
	for i, frame := range r.Frames {
		if i == 0 {
			frame.Meta = &data.FrameMeta{ExecutedQueryString: query.RawQuery, PreferredVisualization: util.GetVisType(query.ResultFormat)}
		}
	}

	return r
}
