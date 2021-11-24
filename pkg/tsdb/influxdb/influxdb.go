package influxdb

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"path"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/coreplugin"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/influxdb/flux"
	"github.com/grafana/grafana/pkg/tsdb/influxdb/models"
)

const pluginID = "influxdb"

type Service struct {
	QueryParser    *InfluxdbQueryParser
	ResponseParser *ResponseParser
	glog           log.Logger

	im instancemgmt.InstanceManager
}

var ErrInvalidHttpMode = errors.New("'httpMode' should be either 'GET' or 'POST'")

func ProvideService(httpClient httpclient.Provider, pluginStore plugins.Store, cfg *setting.Cfg) (*Service, error) {
	im := datasource.NewInstanceManager(newInstanceSettings(httpClient))
	s := &Service{
		QueryParser:    &InfluxdbQueryParser{},
		ResponseParser: &ResponseParser{},
		glog:           log.New("tsdb.influxdb"),
		im:             im,
	}

	factory := coreplugin.New(backend.ServeOpts{
		QueryDataHandler: s,
	})

	resolver := plugins.CoreBackendPluginPathResolver(cfg, pluginID)
	if err := pluginStore.AddWithFactory(context.Background(), pluginID, factory, resolver); err != nil {
		s.glog.Error("Failed to register plugin", "error", err)
		return nil, err
	}

	return s, nil
}

func newInstanceSettings(httpClientProvider httpclient.Provider) datasource.InstanceFactoryFunc {
	return func(settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
		opts, err := settings.HTTPClientOptions()
		if err != nil {
			return nil, err
		}

		client, err := httpClientProvider.New(opts)
		if err != nil {
			return nil, err
		}

		jsonData := models.DatasourceInfo{}
		err = json.Unmarshal(settings.JSONData, &jsonData)
		if err != nil {
			return nil, fmt.Errorf("error reading settings: %w", err)
		}
		httpMode := jsonData.HTTPMode
		if httpMode == "" {
			httpMode = "GET"
		}
		maxSeries := jsonData.MaxSeries
		if maxSeries == 0 {
			maxSeries = 1000
		}
		model := &models.DatasourceInfo{
			HTTPClient:    client,
			URL:           settings.URL,
			Database:      settings.Database,
			Version:       jsonData.Version,
			HTTPMode:      httpMode,
			TimeInterval:  jsonData.TimeInterval,
			DefaultBucket: jsonData.DefaultBucket,
			Organization:  jsonData.Organization,
			MaxSeries:     maxSeries,
			Token:         settings.DecryptedSecureJSONData["token"],
		}
		return model, nil
	}
}

func (s *Service) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	s.glog.Debug("Received a query request", "numQueries", len(req.Queries))

	dsInfo, err := s.getDSInfo(req.PluginContext)
	if err != nil {
		return nil, err
	}
	version := dsInfo.Version
	if version == "Flux" {
		return flux.Query(ctx, dsInfo, *req)
	}

	s.glog.Debug("Making a non-Flux type query")

	// NOTE: the following path is currently only called from alerting queries
	// In dashboards, the request runs through proxy and are managed in the frontend

	query, err := s.getQuery(dsInfo, req)
	if err != nil {
		return &backend.QueryDataResponse{}, err
	}

	rawQuery, err := query.Build(req)
	if err != nil {
		return &backend.QueryDataResponse{}, err
	}

	if setting.Env == setting.Dev {
		s.glog.Debug("Influxdb query", "raw query", rawQuery)
	}

	request, err := s.createRequest(ctx, dsInfo, rawQuery)
	if err != nil {
		return &backend.QueryDataResponse{}, err
	}

	res, err := dsInfo.HTTPClient.Do(request)
	if err != nil {
		return &backend.QueryDataResponse{}, err
	}
	defer func() {
		if err := res.Body.Close(); err != nil {
			s.glog.Warn("Failed to close response body", "err", err)
		}
	}()
	if res.StatusCode/100 != 2 {
		return &backend.QueryDataResponse{}, fmt.Errorf("InfluxDB returned error status: %s", res.Status)
	}

	resp := s.ResponseParser.Parse(res.Body, query)

	return resp, nil
}

func (s *Service) getQuery(dsInfo *models.DatasourceInfo, query *backend.QueryDataRequest) (*Query, error) {
	queryCount := len(query.Queries)

	// The model supports multiple queries, but right now this is only used from
	// alerting so we only needed to support batch executing 1 query at a time.
	if queryCount != 1 {
		return nil, fmt.Errorf("query request should contain exactly 1 query, it contains: %d", queryCount)
	}

	q := query.Queries[0]

	return s.QueryParser.Parse(q)
}

func (s *Service) createRequest(ctx context.Context, dsInfo *models.DatasourceInfo, query string) (*http.Request, error) {
	u, err := url.Parse(dsInfo.URL)
	if err != nil {
		return nil, err
	}

	u.Path = path.Join(u.Path, "query")
	httpMode := dsInfo.HTTPMode

	var req *http.Request
	switch httpMode {
	case "GET":
		req, err = http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
		if err != nil {
			return nil, err
		}
	case "POST":
		bodyValues := url.Values{}
		bodyValues.Add("q", query)
		body := bodyValues.Encode()
		req, err = http.NewRequestWithContext(ctx, http.MethodPost, u.String(), strings.NewReader(body))
		if err != nil {
			return nil, err
		}
	default:
		return nil, ErrInvalidHttpMode
	}

	req.Header.Set("User-Agent", "Grafana")

	params := req.URL.Query()
	params.Set("db", dsInfo.Database)
	params.Set("epoch", "s")

	if httpMode == "GET" {
		params.Set("q", query)
	} else if httpMode == "POST" {
		req.Header.Set("Content-type", "application/x-www-form-urlencoded")
	}

	req.URL.RawQuery = params.Encode()

	s.glog.Debug("Influxdb request", "url", req.URL.String())
	return req, nil
}

func (s *Service) getDSInfo(pluginCtx backend.PluginContext) (*models.DatasourceInfo, error) {
	i, err := s.im.Get(pluginCtx)
	if err != nil {
		return nil, err
	}

	instance, ok := i.(*models.DatasourceInfo)
	if !ok {
		return nil, fmt.Errorf("failed to cast datsource info")
	}

	return instance, nil
}
