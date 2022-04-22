package loki

import (
	"context"
	"fmt"
	"net/url"
	"strconv"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/infra/log"
	jsoniter "github.com/json-iterator/go"
)

// extracted to separate function for easier testing
func checkHealth(ctx context.Context, api *LokiAPI, log log.Logger) (*backend.CheckHealthResult, error) {
	// we run a query for labels for the last 10 minutes
	endTime := time.Now().UnixNano()
	startTime := endTime - (10 * 60 * 1000 * 1000 * 1000) // 10 minutes difference

	qs := url.Values{}
	qs.Set("start", strconv.FormatInt(startTime, 10))
	qs.Set("end", strconv.FormatInt(endTime, 10))

	url := fmt.Sprintf("/loki/api/v1/labels?%s", qs.Encode())

	bytes, err := api.RawQuery(ctx, url)

	if err != nil {
		log.Error("Loki Query error", "err", err)
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: "Loki connection error. please inspect the Grafana server log for details",
		}, nil
	}

	info := LokiLabelsResponse{}

	err = jsoniter.Unmarshal(bytes, &info)
	if err != nil {
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: "Loki returned invalid JSON data",
		}, nil
	}

	if info.Status != "success" {
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: "Loki returned an error response",
		}, nil
	}

	if len(info.Data) == 0 {
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusOk,
			Message: "Data source connected, but no labels found",
		}, nil
	}

	return &backend.CheckHealthResult{
		Status:  backend.HealthStatusOk,
		Message: "Data source connected, labels found",
	}, nil
}
