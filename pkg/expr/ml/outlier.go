package ml

import (
	"fmt"
	"net/http"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/api/response"
)

// OutlierCommand implements Command that sends a request to outlier proxy API and converts response to backend.QueryDataResponse
type OutlierCommand struct {
	config   OutlierCommandConfiguration
	appURL   string
	interval time.Duration
}

var _ Command = OutlierCommand{}

func (c OutlierCommand) DatasourceUID() string {
	return c.config.DatasourceUID
}

// Execute copies the original configuration JSON and appends (overwrites) a field "start_end_attributes" and "grafana_url" to the root object.
// The value of "start_end_attributes" is JSON object that configures time range and interval.
// The value of "grafana_url" is app URL that should be used by ML to query the data source.
// After payload is generated it sends it to POST /proxy/api/v1/outlier endpoint and parses the response.
// The proxy API normally responds with a structured data. It recognizes status 200 and 204 as successful result.
// Other statuses are considered unsuccessful and result in error. Tries to extract error from the structured payload.
// Otherwise, mentions the full message in error
func (c OutlierCommand) Execute(from, to time.Time, sendRequest func(method string, path string, payload []byte) (response.Response, error)) (*backend.QueryDataResponse, error) {
	payload := outlierRequestBody{
		Data: outlierData{
			Attributes: outlierAttributes{
				OutlierCommandConfiguration: c.config,
				GrafanaURL:                  c.appURL,
				StartEndAttributes:          newTimeRangeAndInterval(from, to, c.interval),
			},
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
	var respData outlierResponse

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

// unmarshalOutlierCommand parses the CommandConfiguration.Config, validates data and produces OutlierCommand.
func unmarshalOutlierCommand(expr CommandConfiguration, appURL string) (*OutlierCommand, error) {
	var cfg OutlierCommandConfiguration
	err := json.Unmarshal(expr.Config, &cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal outlier command: %w", err)
	}
	if len(cfg.DatasourceUID) == 0 {
		return nil, fmt.Errorf("required field `config.datasource_uid` is not specified")
	}

	if len(cfg.Query) == 0 && len(cfg.QueryParams) == 0 {
		return nil, fmt.Errorf("neither of required fields `config.query_params` or `config.query` are specified")
	}

	if len(cfg.ResponseType) == 0 {
		return nil, fmt.Errorf("required field `config.response_type` is not specified")
	}

	if len(cfg.Algorithm) == 0 {
		return nil, fmt.Errorf("required field `config.algorithm` is not specified")
	}

	interval := defaultInterval
	if expr.IntervalMs != nil {
		i := time.Duration(*expr.IntervalMs) * time.Millisecond
		if i > 0 {
			interval = i
		}
	}

	return &OutlierCommand{
		config:   cfg,
		interval: interval,
		appURL:   appURL,
	}, nil
}
