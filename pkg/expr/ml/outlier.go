package ml

import (
	"fmt"
	"net/http"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	jsoniter "github.com/json-iterator/go"

	"github.com/grafana/grafana/pkg/api/response"
)

type OutlierCommand struct {
	query         jsoniter.RawMessage
	datasourceUID string
	appURL        string
	interval      time.Duration
}

var _ Command = OutlierCommand{}

func (c OutlierCommand) DatasourceUID() string {
	return c.datasourceUID
}

func (c OutlierCommand) Execute(from, to time.Time, execute func(method string, path string, payload []byte) (response.Response, error)) (*backend.QueryDataResponse, error) {
	var dataMap map[string]interface{}
	err := json.Unmarshal(c.query, &dataMap)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal query: %w", err)
	}

	dataMap["start_end_attributes"] = map[string]interface{}{
		"start":    from.Format(timeFormat),
		"end":      to.Format(timeFormat),
		"interval": c.interval.Milliseconds(),
	}
	dataMap["grafana_url"] = c.appURL

	payload := map[string]interface{}{
		"data": map[string]interface{}{
			"attributes": dataMap,
		},
	}

	requestBody, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	resp, err := execute(http.MethodPost, "/proxy/api/v1/outlier", requestBody)

	if err != nil {
		return nil, fmt.Errorf("failed to call ML API: %w", err)
	}
	if resp == nil {
		return nil, fmt.Errorf("response is nil")
	}

	// Outlier proxy API usually returns all responses with this body.
	var respData struct {
		Status string                     `json:"status"`
		Data   *backend.QueryDataResponse `json:"data,omitempty"`
		Error  string                     `json:"error,omitempty"`
	}

	respBody := resp.Body()
	err = json.Unmarshal(respBody, &respData)
	if err != nil {
		return nil, fmt.Errorf("unexpected format of the response from ML API, status: %d, response: %s", resp.Status(), respBody)
	}

	if respData.Status == "error" {
		return nil, fmt.Errorf("ML API responded with error: %s", respData.Error)
	}

	if resp.Status() == http.StatusNoContent {
		return nil, nil
	}

	if resp.Status() == http.StatusOK {
		return respData.Data, nil
	}

	return nil, fmt.Errorf("unexpected status %d returned by ML API, response: %s", resp.Status(), respBody)
}

func unmarshalOutlierCommand(q jsoniter.Any, appURL string) (*OutlierCommand, error) {
	interval := defaultInterval
	switch intervalNode := q.Get("intervalMs"); intervalNode.ValueType() {
	case jsoniter.NilValue:
	case jsoniter.InvalidValue:
	case jsoniter.NumberValue:
		interval = time.Duration(intervalNode.ToInt64()) * time.Millisecond
	default:
		return nil, fmt.Errorf("field `intervalMs` is expected to be a number")
	}

	cfgNode := q.Get("config")
	if cfgNode.ValueType() != jsoniter.ObjectValue {
		return nil, fmt.Errorf("field `config` is required and should be object")
	}
	ds := cfgNode.Get("datasource_uid").ToString()
	if len(ds) == 0 {
		return nil, fmt.Errorf("field `config.datasource_uid` is required and should be string")
	}

	d, err := json.Marshal(cfgNode.GetInterface())
	if err != nil {
		return nil, err
	}

	return &OutlierCommand{
		query:         d,
		datasourceUID: ds,
		interval:      interval,
		appURL:        appURL,
	}, nil
}
