package utils

import (
	"compress/flate"
	"compress/gzip"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"

	"github.com/andybalholm/brotli"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"

	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/types"
)

const SubscriptionsApiVersion = "2020-01-01"

func GetFirstSubscriptionOrDefault(ctx context.Context, dsInfo types.DatasourceInfo, logger log.Logger) (string, error) {
	if dsInfo.Settings.SubscriptionId != "" {
		return dsInfo.Settings.SubscriptionId, nil
	}

	url := fmt.Sprintf("%v/subscriptions?api-version=%v", dsInfo.Routes["Azure Monitor"].URL, SubscriptionsApiVersion)
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return "", err
	}

	res, err := dsInfo.Services["Azure Monitor"].HTTPClient.Do(request)
	if err != nil {
		return "", backend.DownstreamError(fmt.Errorf("failed to retrieve subscriptions: %v", err))
	}
	defer func() {
		if err := res.Body.Close(); err != nil {
			logger.Warn("Failed to close response body", "err", err)
		}
	}()

	subscriptions, err := ParseSubscriptions(res, logger)
	if err != nil {
		return "", fmt.Errorf("failed to parse subscriptions: %v", err)
	}

	if len(subscriptions) == 0 {
		return "", backend.DownstreamError(fmt.Errorf("no subscriptions found: %v", err))
	}

	return subscriptions[0], nil
}

func ParseSubscriptions(res *http.Response, logger log.Logger) ([]string, error) {
	var target struct {
		Value []struct {
			SubscriptionId string `json:"subscriptionId"`
		}
	}
	err := json.NewDecoder(res.Body).Decode(&target)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err := res.Body.Close(); err != nil {
			logger.Warn("Failed to close response body", "err", err)
		}
	}()

	result := make([]string, len(target.Value))
	for i, v := range target.Value {
		result[i] = v.SubscriptionId
	}

	return result, nil
}

func ApplySourceFromError(errorMessage error, err error) error {
	var errorWithSource backend.ErrorWithSource
	if errors.As(err, &errorWithSource) {
		if errorWithSource.ErrorSource() == backend.ErrorSourcePlugin {
			return backend.PluginError(errorMessage)
		}
		return backend.DownstreamError(errorMessage)
	}
	return errorMessage
}

func CreateResponseErrorFromStatusCode(statusCode int, status string, body []byte) error {
	statusErr := fmt.Errorf("request failed, status: %s, body: %s", status, string(body))
	if backend.ErrorSourceFromHTTPStatus(statusCode) == backend.ErrorSourceDownstream {
		return backend.DownstreamError(statusErr)
	}
	return backend.PluginError(statusErr)
}

// This function handles various compression mechanisms that may have been used on a response body
func Decode(encoding string, original io.ReadCloser) ([]byte, error) {
	var reader io.Reader
	var err error
	switch encoding {
	case "gzip":
		reader, err = gzip.NewReader(original)
		if err != nil {
			return nil, err
		}
		defer func() {
			if err := reader.(io.ReadCloser).Close(); err != nil {
				backend.Logger.Warn("Failed to close reader body", "err", err)
			}
		}()
	case "deflate":
		reader = flate.NewReader(original)
		defer func() {
			if err := reader.(io.ReadCloser).Close(); err != nil {
				backend.Logger.Warn("Failed to close reader body", "err", err)
			}
		}()
	case "br":
		reader = brotli.NewReader(original)
	case "":
		reader = original
	default:
		return nil, fmt.Errorf("unexpected encoding type %v", err)
	}

	body, err := io.ReadAll(reader)
	if err != nil {
		return nil, err
	}
	return body, nil
}
