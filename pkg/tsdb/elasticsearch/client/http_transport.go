package es

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"net/url"
	"path"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
)

// httpTransport handles HTTP communication with Elasticsearch
type httpTransport struct {
	ctx        context.Context
	httpClient *http.Client
	baseURL    string
	logger     log.Logger
}

// newHTTPTransport creates a new HTTP transport
func newHTTPTransport(ctx context.Context, httpClient *http.Client, baseURL string, logger log.Logger) *httpTransport {
	return &httpTransport{
		ctx:        ctx,
		httpClient: httpClient,
		baseURL:    baseURL,
		logger:     logger,
	}
}

// executeBatchRequest executes a batch request to Elasticsearch
func (t *httpTransport) executeBatchRequest(uriPath, uriQuery string, body []byte) (*http.Response, error) {
	return t.executeRequest(http.MethodPost, uriPath, uriQuery, body)
}

// executeRequest executes an HTTP request to Elasticsearch
func (t *httpTransport) executeRequest(method, uriPath, uriQuery string, body []byte) (*http.Response, error) {
	t.logger.Debug("Sending request to Elasticsearch", "url", t.baseURL)
	u, err := url.Parse(t.baseURL)
	if err != nil {
		return nil, backend.DownstreamError(fmt.Errorf("URL could not be parsed: %w", err))
	}
	u.Path = path.Join(u.Path, uriPath)
	u.RawQuery = uriQuery

	var req *http.Request
	if method == http.MethodPost {
		req, err = http.NewRequestWithContext(t.ctx, http.MethodPost, u.String(), bytes.NewBuffer(body))
	} else {
		req, err = http.NewRequestWithContext(t.ctx, http.MethodGet, u.String(), nil)
	}
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/x-ndjson")

	//nolint:bodyclose
	resp, err := t.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

//"{\"ignore_unavailable\":true,\"index\":\"\",\"search_type\":\"query_then_fetch\"}\n{\"aggs\":{\"2\":{\"date_histogram\":{\"field\":\"@timestamp\",\"fixed_interval\":\"2000ms\",\"min_doc_count\":0,\"extended_bounds\":{\"min\":1762226056504,\"max\":1762229656504},\"format\":\"epoch_millis\"}}},\"query\":{\"bool\":{\"filter\":{\"range\":{\"@timestamp\":{\"format\":\"epoch_millis\",\"gte\":1762226056504,\"lte\":1762229656504}}}}},\"size\":0}\n"
//"{\"ignore_unavailable\":true,\"index\":\"\",\"search_type\":\"query_then_fetch\"}\n{\"aggs\":{\"2\":{\"date_histogram\":{\"extended_bounds\":{\"max\":1762229656504,\"min\":1762226056504},\"field\":\"@timestamp\",\"fixed_interval\":\"2000ms\",\"format\":\"epoch_millis\",\"min_doc_count\":0}}},\"query\":{\"bool\":{\"filter\":{\"range\":{\"@timestamp\":{\"format\":\"epoch_millis\",\"gte\":1762226056504,\"lte\":1762229656504}}}}},\"size\":0}\n"

//"{\"ignore_unavailable\":true,\"index\":\"\",\"search_type\":\"query_then_fetch\"}\n{\"aggs\":{\"count_by_status\":{\"terms\":{\"field\":\"status.keyword\",\"size\":10}}},\"size\":0}\n"
//"{\"ignore_unavailable\":true,\"index\":\"\",\"search_type\":\"query_then_fetch\"}\n{\"aggs\":{\"2\":{\"aggs\":{\"1\":{\"max\":{\"field\":\"value\"}}},\"date_histogram\":{\"field\":\"@timestamp\",\"fixed_interval\":\"2000ms\",\"min_doc_count\":0,\"extended_bounds\":{\"min\":1762273734107,\"max\":1762277334107},\"format\":\"epoch_millis\"}}},\"query\":{\"bool\":{\"filter\":{\"range\":{\"@timestamp\":{\"format\":\"epoch_millis\",\"gte\":1762273734107,\"lte\":1762277334107}}}}},\"size\":0}\n"

/*
{"ignore_unavailable":true,"index":"","search_type":"query_then_fetch"},
{
  "aggs": {
    "2": {
      "aggs": {
        "1": {
          "max": {
            "field": "value"
          }
        }
      },
      "date_histogram": {
        "field": "@timestamp",
        "fixed_interval": "2000ms",
        "min_doc_count": 0,
        "extended_bounds": {
          "min": 1762273734107,
          "max": 1762277334107
        },
        "format": "epoch_millis"
      }
    }
  },
  "query": {
    "bool": {
      "filter": {
        "range": {
          "@timestamp": {
            "format": "epoch_millis",
            "gte": 1762273734107,
            "lte": 1762277334107
          }
        }
      }
    }
  },
  "size": 0
}
*/
