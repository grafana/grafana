package util

import (
	"net/http"
	"net/url"

	"github.com/grafana/grafana/pkg/infra/log"
)

type httpTestClient struct {
	serviceURL string
	httpCli    *http.Client
	log        log.Logger
	headers    map[string]string
}

func NewHTTPTestClient(serviceURL string, httpClient *http.Client, headers map[string]string) *httpTestClient {
	return &httpTestClient{
		serviceURL: serviceURL,
		httpCli:    httpClient,
		headers:    headers,
		log:        log.New("e2e_http_test_client"),
	}
}

func (q *httpTestClient) GetRequest(path string) (*http.Response, error) {
	requestPath, err := url.JoinPath(q.serviceURL, path)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest(http.MethodGet, requestPath, nil)
	if err != nil {
		return nil, err
	}

	for key, value := range q.headers {
		req.Header.Add(key, value)
	}

	res, err := q.httpCli.Do(req)
	if err != nil {
		return nil, err
	}
	return res, nil
}
