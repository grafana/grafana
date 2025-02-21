package fsql

import (
	"context"
	"fmt"
	"net/url"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"google.golang.org/grpc/metadata"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/tsdb/influxdb/models"
)

var (
	glog = log.New("tsdb.influx_flightsql")
)

type SQLOptions struct {
	Addr     string              `json:"host"`
	Metadata []map[string]string `json:"metadata"`
	Token    string              `json:"token"`
}

func Query(ctx context.Context, dsInfo *models.DatasourceInfo, req backend.QueryDataRequest) (
	*backend.QueryDataResponse, error) {
	logger := glog.FromContext(ctx)
	tRes := backend.NewQueryDataResponse()
	r, err := runnerFromDataSource(dsInfo)
	if err != nil {
		return tRes, err
	}
	defer func(client *client) {
		err := client.Close()
		if err != nil {
			logger.Warn("Failed to close fsql client", "err", err)
		}
	}(r.client)

	if r.client.md.Len() != 0 {
		ctx = metadata.NewOutgoingContext(ctx, r.client.md)
	}

	for _, q := range req.Queries {
		qm, err := getQueryModel(q)
		if err != nil {
			tRes.Responses[q.RefID] = backend.ErrDataResponseWithSource(backend.StatusValidationFailed, backend.ErrorSourceDownstream, "bad request")
			continue
		}

		logger.Info(fmt.Sprintf("InfluxDB executing SQL: %s", qm.RawSQL))
		info, err := r.client.Execute(ctx, qm.RawSQL)
		if err != nil {
			tRes.Responses[q.RefID] = backend.ErrDataResponse(backend.StatusInternal, fmt.Sprintf("flightsql: %s", err))
			return tRes, nil
		}
		if len(info.Endpoint) != 1 {
			tRes.Responses[q.RefID] = backend.ErrDataResponse(backend.StatusInternal, fmt.Sprintf("unsupported endpoint count in response: %d", len(info.Endpoint)))
			return tRes, nil
		}

		reader, err := r.client.DoGetWithHeaderExtraction(ctx, info.Endpoint[0].Ticket)
		if err != nil {
			tRes.Responses[q.RefID] = backend.ErrDataResponse(backend.StatusInternal, fmt.Sprintf("flightsql: %s", err))
			return tRes, nil
		}
		defer reader.Release()

		headers, err := reader.Header()
		if err != nil {
			logger.Error(fmt.Sprintf("Failed to extract headers: %s", err))
		}

		tRes.Responses[q.RefID] = newQueryDataResponse(reader, *qm.Query, headers)
	}

	return tRes, nil
}

type runner struct {
	client *client
}

// runnerFromDataSource creates a runner from the datasource model (the datasource instance's configuration).
func runnerFromDataSource(dsInfo *models.DatasourceInfo) (*runner, error) {
	if dsInfo.URL == "" {
		return nil, fmt.Errorf("missing URL from datasource configuration")
	}

	u, err := url.Parse(dsInfo.URL)
	if err != nil {
		return nil, fmt.Errorf("bad URL : %s", err)
	}

	addr := u.Host
	if u.Port() == "" {
		addr += ":443"
	}

	md := metadata.MD{}
	if dsInfo.DbName != "" {
		md.Set("database", dsInfo.DbName)
	}
	if dsInfo.Token != "" {
		md.Set("Authorization", fmt.Sprintf("Bearer %s", dsInfo.Token))
	}

	fsqlClient, err := newFlightSQLClient(addr, md, !dsInfo.InsecureGrpc)
	if err != nil {
		return nil, err
	}

	return &runner{
		client: fsqlClient,
	}, nil
}
