package loki

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/loki/pkg/loghttp"
	jsoniter "github.com/json-iterator/go"
)

type LokiAPI struct {
	client *http.Client
	url    string
	log    log.Logger
}

func newLokiAPI(client *http.Client, url string, log log.Logger) *LokiAPI {
	return &LokiAPI{client: client, url: url, log: log}
}

func makeRequest(ctx context.Context, lokiDsUrl string, query lokiQuery) (*http.Request, error) {
	qs := url.Values{}
	qs.Set("query", query.Expr)
	qs.Set("step", query.Step.String())
	qs.Set("start", strconv.FormatInt(query.Start.UnixNano(), 10))
	qs.Set("end", strconv.FormatInt(query.End.UnixNano(), 10))

	lokiUrl, err := url.Parse(lokiDsUrl)
	if err != nil {
		return nil, err
	}

	lokiUrl.Path = "/loki/api/v1/query_range"
	lokiUrl.RawQuery = qs.Encode()

	req, err := http.NewRequestWithContext(ctx, "GET", lokiUrl.String(), nil)
	if err != nil {
		return nil, err
	}

	// NOTE:
	// 1. we are missing "dynamic" http params, like OAuth data.
	// this never worked before (and it is not needed for alerting scenarios),
	// so it is not a regression.
	// i am just making a note here,
	// that we need to have that when we migrate to backend-queries.
	//
	// 2. we will have to send a custom http header based on the VolumeQuery prop
	// (again, not needed for the alerting scenario)
	// if query.VolumeQuery {
	// 	req.Header.Set("X-Query-Tags", "Source=logvolhist")
	// }

	return req, nil
}

type lokiError struct {
	Message string
}

// we know there is an error,
// based on the http-response-body
// we have to make an informative error-object
func makeLokiError(body io.ReadCloser) error {
	var buf bytes.Buffer
	_, err := buf.ReadFrom(body)
	if err != nil {
		return err
	}

	bytes := buf.Bytes()

	// the error-message is probably a JSON structure,
	// with a string-field named "message". we want the
	// value of that field.
	// but, the response might be just a simple string,
	// this was used in older Loki versions.
	// so our approach is this:
	// - we try to convert the bytes to JSON
	// - we take the value of the field "message"
	// - if any of these steps fail, or if "message" is empty, we return the whole text

	var data lokiError
	err = json.Unmarshal(bytes, &data)
	if err != nil {
		// we were unable to convert the bytes to JSON, we return the whole text
		return fmt.Errorf("%v", string(bytes))
	}

	errorMessage := data.Message

	if errorMessage == "" {
		// we got no usable error message, we return the whole text
		return fmt.Errorf("%v", string(bytes))
	}

	return fmt.Errorf("%v", errorMessage)
}

func (api *LokiAPI) QueryRange(ctx context.Context, query lokiQuery) (*loghttp.QueryResponse, error) {
	req, err := makeRequest(ctx, api.url, query)
	if err != nil {
		return nil, err
	}

	resp, err := api.client.Do(req)
	if err != nil {
		return nil, err
	}

	defer func() {
		if err := resp.Body.Close(); err != nil {
			api.log.Warn("Failed to close response body", "err", err)
		}
	}()

	if resp.StatusCode/100 != 2 {
		return nil, makeLokiError(resp.Body)
	}

	var response loghttp.QueryResponse
	err = jsoniter.NewDecoder(resp.Body).Decode(&response)
	if err != nil {
		return nil, err
	}

	return &response, nil
}
