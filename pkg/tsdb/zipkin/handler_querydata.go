package zipkin

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/errorsource"
)

type zipkinQueryType string

const (
	zipkinQueryTypeTraceId zipkinQueryType = "traceID"
	zipkinQueryTypeUpload  zipkinQueryType = "upload"
)

type zipkinQuery struct {
	Query     string          `json:"query,omitempty"`
	QueryType zipkinQueryType `json:"queryType,omitempty"`
}

func loadQuery(ctx context.Context, backendQuery backend.DataQuery, pluginContext backend.PluginContext) (zipkinQuery, error) {
	var query zipkinQuery
	err := json.Unmarshal(backendQuery.JSON, &query)
	if err != nil {
		return query, errorsource.PluginError(fmt.Errorf("error while parsing the query json. %w", err), false)
	}
	return query, err
}

func (s *Service) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	response := backend.NewQueryDataResponse()
	logger := logger.FromContext(ctx)
	dsInfo, err := s.getDSInfo(ctx, req.PluginContext)
	if err != nil {
		return nil, err
	}
	for _, q := range req.Queries {
		query, err := loadQuery(ctx, q, req.PluginContext)
		if err != nil {
			logger.Error("error un-marshaling the query", "error", err.Error())
		}
		switch query.QueryType {
		case zipkinQueryTypeUpload:
			response.Responses[q.RefID] = backend.DataResponse{
				Error: fmt.Errorf("unsupported query type %s. only available in frontend mode", query.QueryType),
			}
		default:
			traces, err := dsInfo.ZipkinClient.Trace(url.PathEscape(query.Query))
			if err != nil {
				response.Responses[q.RefID] = backend.DataResponse{Error: err}
				continue
			}
			// TODO: instead of sending custom data, implement equivalent of responseToDataQueryResponse from frontend
			// public/app/plugins/datasource/zipkin/datasource.ts
			response.Responses[q.RefID] = backend.DataResponse{
				Frames: []*data.Frame{
					data.NewFrame("query").SetMeta(&data.FrameMeta{
						Custom: traces,
					}),
				},
			}
		}
	}
	return response, err
}
