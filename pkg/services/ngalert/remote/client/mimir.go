package client

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"

	"github.com/grafana/grafana/pkg/infra/log"
)

// Client contains all the methods to query the migration critical endpoints of Mimir instance, it's an interface to allow multiple implementations.
type Client interface {
	GetGrafanaAlertmanagerConfiguration()
	SetGrafanaAlertmanagerConfiguration()
	DeleteGrafanaAlertmanagerConfiguration()

	GetGrafanaAlertmanagerState()
	SetGrafanaAlertmanagerState()
	DeleteGrafanaAlertmanagerState()
}

type Mimir struct {
	endpoint *url.URL
	client   http.Client
	logger   log.Logger
}

type Config struct {
	Address string
	Logger  log.Logger
}

type successResponse struct {
	Status string `json:"status"`
	Data   any    `json:"data"`
}

type errorResponse struct {
	Status string `json:"status"`
	Error  string `json:"error"`
}

func New(cfg *Config) (*Mimir, error) {
	endpoint, err := url.Parse(cfg.Address)
	if err != nil {
		return nil, err
	}

	c := http.Client{}

	return &Mimir{
		endpoint: endpoint,
		client:   c,
		logger:   cfg.Logger,
	}, nil

}

func (mc *Mimir) do(ctx context.Context, p, method string, payload io.Reader, contentLength int64, out any) error {
	pathURL, err := url.Parse(p)
	if err != nil {
		return nil
	}

	endpoint := *mc.endpoint
	endpoint.Path = path.Join(endpoint.Path, pathURL.Path)

	r, err := http.NewRequestWithContext(ctx, method, endpoint.String(), payload)
	if err != nil {
		return nil
	}

	if contentLength > 0 {
		r.ContentLength = contentLength
	}

	logger := mc.logger.New("url", r.URL.String(), "method", r.Method)

	resp, err := mc.client.Do(r)
	if err != nil {
		logger.Debug("unable to fulfill request to the Mimir API", "err", err)
		return nil
	}

	if resp.StatusCode/100 != 2 {
		errResponse := &errorResponse{}
		if jsonErr := json.NewDecoder(resp.Body).Decode(errResponse); jsonErr != nil {
			logger.Error("unable to decode JSON error response", "err", jsonErr)
			return nil
		}

		return nil
	}

	sr := successResponse{
		Data: out,
	}
	if err := json.NewDecoder(resp.Body).Decode(&sr); err != nil {
		logger.Error("unable to decode JSON success response", "err", err)
		return nil
	}

	switch sr.Status {
	case "success":
		out = sr.Data
		return nil
	case "error":
		logger.Error("received a 2xx status code but no success response")
	default:
		return fmt.Errorf("received a 2xx status code but no success or error status: %s", sr.Status)
	}

	return nil
}
