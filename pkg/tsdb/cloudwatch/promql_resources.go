package cloudwatch

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"time"

	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
)

type promqlStringListResponse struct {
	Status    string   `json:"status"`
	Data      []string `json:"data"`
	Error     string   `json:"error,omitempty"`
	ErrorType string   `json:"errorType,omitempty"`
}

func buildPromQLForwardParams(params url.Values) url.Values {
	cwParams := url.Values{}
	for _, name := range []string{"start", "end", "limit"} {
		if v := params.Get(name); v != "" {
			cwParams.Set(name, v)
		}
	}
	if match := params.Get("match"); match != "" {
		cwParams.Set("match[]", match)
	}
	return cwParams
}

func (ds *DataSource) PromQLLabelKeysHandler(ctx context.Context, params url.Values) ([]byte, *models.HttpError) {
	region := params.Get("region")
	if region == "" || region == defaultRegion {
		region = ds.Settings.Region
	}

	body, status, err := ds.promqlSignedGet(ctx, region, "/api/v1/labels", buildPromQLForwardParams(params), 30*time.Second)
	if err != nil {
		return nil, models.NewHttpError("failed to fetch PromQL label keys", http.StatusInternalServerError, err)
	}
	if status != http.StatusOK {
		return nil, models.NewHttpError("failed to fetch PromQL label keys", http.StatusInternalServerError, fmt.Errorf("CloudWatch PromQL API returned %d: %s", status, body))
	}

	data, err := decodePromQLStringListResponse(body)
	if err != nil {
		return nil, models.NewHttpError("failed to fetch PromQL label keys", http.StatusInternalServerError, err)
	}

	out, err := json.Marshal(data)
	if err != nil {
		return nil, models.NewHttpError("failed to encode PromQL label keys", http.StatusInternalServerError, err)
	}
	return out, nil
}

func (ds *DataSource) PromQLLabelValuesHandler(ctx context.Context, params url.Values) ([]byte, *models.HttpError) {
	region := params.Get("region")
	if region == "" || region == defaultRegion {
		region = ds.Settings.Region
	}

	labelKey := params.Get("labelKey")
	if labelKey == "" {
		return nil, models.NewHttpError("labelKey parameter is required", http.StatusBadRequest, nil)
	}

	path := fmt.Sprintf("/api/v1/label/%s/values", url.PathEscape(labelKey))
	body, status, err := ds.promqlSignedGet(ctx, region, path, buildPromQLForwardParams(params), 30*time.Second)
	if err != nil {
		return nil, models.NewHttpError("failed to fetch PromQL label values", http.StatusInternalServerError, err)
	}
	if status == http.StatusNotFound || status == http.StatusBadRequest {
		return []byte("[]"), nil
	}
	if status != http.StatusOK {
		return nil, models.NewHttpError("failed to fetch PromQL label values", http.StatusInternalServerError, fmt.Errorf("CloudWatch PromQL API returned %d: %s", status, body))
	}

	data, err := decodePromQLStringListResponse(body)
	if err != nil {
		return nil, models.NewHttpError("failed to fetch PromQL label values", http.StatusInternalServerError, err)
	}

	out, err := json.Marshal(data)
	if err != nil {
		return nil, models.NewHttpError("failed to encode PromQL label values", http.StatusInternalServerError, err)
	}
	return out, nil
}

func decodePromQLStringListResponse(body []byte) ([]string, error) {
	var promResp promqlStringListResponse
	if err := json.Unmarshal(body, &promResp); err != nil {
		return nil, fmt.Errorf("failed to parse PromQL response: %w", err)
	}
	if promResp.Status != "success" {
		return nil, fmt.Errorf("PromQL API error (%s): %s", promResp.ErrorType, promResp.Error)
	}
	if promResp.Data == nil {
		return []string{}, nil
	}
	return promResp.Data, nil
}
