package fsql

import (
	"context"
	"fmt"
	"net"
	"net/url"
	"strings"

	"github.com/apache/arrow/go/v12/arrow/flight"
	"github.com/apache/arrow/go/v12/arrow/flight/flightsql"
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
	defer r.client.Close()

	if r.client.md.Len() != 0 {
		ctx = metadata.NewOutgoingContext(ctx, r.client.md)
	}

	for _, q := range req.Queries {
		qm, err := getQueryModel(q)
		if err != nil {
			tRes.Responses[q.RefID] = backend.ErrDataResponse(backend.StatusInternal, "bad request")
			continue
		}

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

// This is an interface to help testing
type queryRunner interface {
	runQuery(ctx context.Context, q string) (*flight.FlightInfo, error)
}

// runQuery executes flightSQL and returns a flightSQL typed result.
func (r *runner) runQuery(ctx context.Context, flightSQLQuery string) (*flight.FlightInfo, error) {
	return r.client.Execute(ctx, flightSQLQuery)
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

	host, port, err := net.SplitHostPort(u.Host)
	if err != nil {
		return nil, fmt.Errorf("bad URL : %s", err)
	}
	addr := strings.Join([]string{host, port}, ":")

	dialOptions, err := grpcDialOptions()
	if err != nil {
		return nil, fmt.Errorf("grpc dial options: %s", err)
	}

	md := metadata.MD{}
	for _, m := range dsInfo.Metadata {
		for k, v := range m {
			if _, ok := md[k]; ok {
				return nil, fmt.Errorf("metadata: duplicate key: %s", k)
			}
			if k != "" {
				md.Set(k, v)
			}
		}
	}

	if dsInfo.Token != "" {
		md.Set("Authorization", fmt.Sprintf("Bearer %s", dsInfo.Token))
	}

	fsqlClient, err := flightsql.NewClient(addr, nil, nil, dialOptions...)
	if err != nil {
		return nil, err
	}

	return &runner{
		client: &client{
			Client: fsqlClient,
			md:     md,
		},
	}, nil
}
