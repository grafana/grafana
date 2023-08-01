package influxql

import (
	"context"
	"errors"
	"net/http"
	"net/url"
	"path"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/influxdb/models"
)

const defaultRetentionPolicy = "default"

var (
	ErrInvalidHttpMode = errors.New("'httpMode' should be either 'GET' or 'POST'")
	glog               = log.New("tsdb.influx_influxql")
)

func Query(ctx context.Context, dsInfo *models.DatasourceInfo, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	logger := glog.FromContext(ctx)
	var allRawQueries string
	queries := make([]models.Query, 0, len(req.Queries))

	for _, reqQuery := range req.Queries {
		query, err := models.QueryParse(reqQuery)
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

	request, err := createRequest(ctx, logger, dsInfo, allRawQueries, "")
	if err != nil {
		return &backend.QueryDataResponse{}, err
	}

	resp, err := execute(dsInfo, logger, queries, request)

	return resp, err
}

func createRequest(ctx context.Context, logger log.Logger, dsInfo *models.DatasourceInfo, query string, retentionPolicy string) (*http.Request, error) {
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
	// default is hardcoded default retention policy
	// InfluxDB will use the default policy when it is not added to the request
	if retentionPolicy != "" && retentionPolicy != "default" {
		params.Set("rp", retentionPolicy)
	}

	if httpMode == "GET" {
		params.Set("q", query)
	} else if httpMode == "POST" {
		req.Header.Set("Content-type", "application/x-www-form-urlencoded")
	}

	req.URL.RawQuery = params.Encode()

	logger.Debug("Influxdb request", "url", req.URL.String())
	return req, nil
}

func execute(dsInfo *models.DatasourceInfo, logger log.Logger, queries []models.Query, request *http.Request) (*backend.QueryDataResponse, error) {
	res, err := dsInfo.HTTPClient.Do(request)
	if err != nil {
		return &backend.QueryDataResponse{}, err
	}
	defer func() {
		if err := res.Body.Close(); err != nil {
			logger.Warn("Failed to close response body", "err", err)
		}
	}()
	resp := ResponseParse(res.Body, res.StatusCode, queries)
	return resp, nil
}
