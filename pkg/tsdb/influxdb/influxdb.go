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
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/influxdb/flux"
	"github.com/grafana/grafana/pkg/tsdb/influxdb/models"
)

var logger log.Logger = log.New("tsdb.influxdb")

type Service struct {
	queryParser    *InfluxdbQueryParser
	responseParser *ResponseParser

	im instancemgmt.InstanceManager
}

var ErrInvalidHttpMode = errors.New("'httpMode' should be either 'GET' or 'POST'")

func ProvideService(httpClient httpclient.Provider) *Service {
	return &Service{
		queryParser:    &InfluxdbQueryParser{},
		responseParser: &ResponseParser{},
		im:             datasource.NewInstanceManager(newInstanceSettings(httpClient)),
	}
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
		version := jsonData.Version
		if version == "" {
			version = influxVersionInfluxQL
		}
		database := jsonData.DbName
		if database == "" {
			database = settings.Database
		}
		model := &models.DatasourceInfo{
			HTTPClient:    client,
			URL:           settings.URL,
			DbName:        database,
			Version:       version,
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
	logger := logger.FromContext(ctx)
	logger.Debug("Received a query request", "numQueries", len(req.Queries))

	dsInfo, err := s.getDSInfo(ctx, req.PluginContext)
	if err != nil {
		return nil, err
	}
	version := dsInfo.Version
	if version == "Flux" {
		return flux.Query(ctx, dsInfo, *req)
	}

	logger.Debug("Making a non-Flux type query")

	var allRawQueries string
	queries := make([]Query, 0, len(req.Queries))

	for _, reqQuery := range req.Queries {
		query, err := s.queryParser.Parse(reqQuery)
		if err != nil {
			return &backend.QueryDataResponse{}, err
		}

		rawQuery, err := query.Build(req)
		if err != nil {
			return &backend.QueryDataResponse{}, err
		}

		allRawQueries = allRawQueries + rawQuery + ";"
		query.RefID = reqQuery.RefID
		query.RawQuery = rawQuery
		queries = append(queries, *query)
	}

	if setting.Env == setting.Dev {
		logger.Debug("Influxdb query", "raw query", allRawQueries)
	}

	request, err := s.createRequest(ctx, logger, dsInfo, allRawQueries)
	if err != nil {
		return &backend.QueryDataResponse{}, err
	}

	res, err := dsInfo.HTTPClient.Do(request)
	if err != nil {
		return &backend.QueryDataResponse{}, err
	}
	defer func() {
		if err := res.Body.Close(); err != nil {
			logger.Warn("Failed to close response body", "err", err)
		}
	}()

	resp := s.responseParser.Parse(res.Body, res.StatusCode, queries)

	return resp, nil
}

func (s *Service) createRequest(ctx context.Context, logger log.Logger, dsInfo *models.DatasourceInfo, query string) (*http.Request, error) {
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

	params := req.URL.Query()
	params.Set("db", dsInfo.DbName)
	params.Set("epoch", "ms")

	if httpMode == "GET" {
		params.Set("q", query)
	} else if httpMode == "POST" {
		req.Header.Set("Content-type", "application/x-www-form-urlencoded")
	}

	req.URL.RawQuery = params.Encode()

	logger.Debug("Influxdb request", "url", req.URL.String())
	return req, nil
}

func (s *Service) getDSInfo(ctx context.Context, pluginCtx backend.PluginContext) (*models.DatasourceInfo, error) {
	i, err := s.im.Get(ctx, pluginCtx)
	if err != nil {
		return nil, err
	}

	instance, ok := i.(*models.DatasourceInfo)
	if !ok {
		return nil, fmt.Errorf("failed to cast datsource info")
	}

	return instance, nil
}
