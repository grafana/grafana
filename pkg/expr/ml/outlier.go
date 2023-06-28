package ml

import (
	"fmt"
	"net/http"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	jsoniter "github.com/json-iterator/go"

	"github.com/grafana/grafana/pkg/api/response"
)

// OutlierCommand sends a request to Machine Learning Outlier Proxy API and parses the request fro
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

// Execute copies the original configuration JSON and appends (overwrites) a field "start_end_attributes" and "grafana_url" to the root object.
// The value of "start_end_attributes" is JSON object that configures time range and interval.
// The value of "grafana_url" is app URL that should be used by ML to query the data source.
// After payload is generated it sends it to POST /proxy/api/v1/outlier endpoint and parses the response.
// The proxy API normally responds with a structured data. It recognizes status 200 and 204 as successful result.
// Other statuses are considered unsuccessful and result in error. Tries to extract error from the structured payload.
// Otherwise, mentions the full message in error
func (c OutlierCommand) Execute(from, to time.Time, sendRequest func(method string, path string, payload []byte) (response.Response, error)) (*backend.QueryDataResponse, error) {
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
	resp, err := sendRequest(http.MethodPost, "/proxy/api/v1/outlier", requestBody)

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

// unmarshalOutlierCommand lazily parses the outlier command configuration and produces OutlierCommand.
// "intervalMs" (optional) must be number, converted to int - represents interval parameter that is used during execution
// "config" (required) a JSON object that is used as a template during command execution, that adds\updates some fields (see Execute for more details).
// The "config" object must contain a field "datasource_uid". Other fields are not validated
func unmarshalOutlierCommand(q jsoniter.Any, appURL string) (*OutlierCommand, error) {
	interval := defaultInterval
	switch intervalNode := q.Get("intervalMs"); intervalNode.ValueType() { //nolint:exhaustive
	case jsoniter.NilValue: // has explicit null
	case jsoniter.InvalidValue: // means that it does not exist
	case jsoniter.NumberValue:
		interval = time.Duration(intervalNode.ToInt64()) * time.Millisecond
	default:
		return nil, fmt.Errorf("field `intervalMs` is expected to be a number")
	}

	cfgNode := q.Get("config")
	// config is expected to be a JSON object like
	// {
	//		"datasource_uid": "a4ce599c-4c93-44b9-be5b-76385b8c01be",
	//		"datasource_type": "prometheus",
	//		"query_params": {
	//			"expr": "go_goroutines{}",
	//			"range": true,
	//			"refId": "A"
	//		},
	//		"response_type": "binary"|"label"|"score",
	//		"algorithm": {
	//			"name": "dbscan"|"mad",
	//			"config": {
	//				"epsilon": 7.667
	//			},
	//			"sensitivity": 0.83
	//		}
	//	}
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
