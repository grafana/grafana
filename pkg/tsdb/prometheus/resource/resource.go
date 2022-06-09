package resource

import (
	"bytes"
	"compress/gzip"
	"context"
	"io/ioutil"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/tsdb/prometheus/client"
)

type Resource struct {
	client  *client.Client
	log     log.Logger
	baseURL string
}

func New(
	apiClient *client.Client,
	plog log.Logger,
	baseURL string,
) *Resource {
	return &Resource{
		log:     plog,
		baseURL: baseURL,
		client:  apiClient,
	}
}

func (r *Resource) Execute(ctx context.Context, resourceReq *backend.CallResourceRequest) (int, []byte, error) {
	r.log.Debug("Sending resource query", "URL", resourceReq.URL)

	req, err := http.NewRequestWithContext(ctx, resourceReq.Method, resourceReq.URL, bytes.NewReader(resourceReq.Body))
	if err != nil {
		return http.StatusInternalServerError, nil, err
	}

	resp, err := r.client.RoundTrip(req)
	if err != nil {
		if resp != nil {
			return resp.StatusCode, nil, err
		}
		return http.StatusInternalServerError, nil, err
	}

	body, err := getRespBody(resp)
	if err != nil {
		return http.StatusInternalServerError, nil, err
	}

	return resp.StatusCode, body, nil
}

func getRespBody(resp *http.Response) ([]byte, error) {
	var (
		reader       = resp.Body
		err    error = nil
	)

	defer func() { _ = resp.Body.Close() }()

	if resp.Header.Get("Content-Encoding") == "gzip" {
		reader, err = gzip.NewReader(resp.Body)
		if err != nil {
			return nil, err
		}
	}

	defer func() { _ = reader.Close() }()

	return ioutil.ReadAll(reader)
}
