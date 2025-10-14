package jaeger

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/tsdb/jaeger/types"
)

type JaegerQuery struct {
	QueryType   string `json:"queryType"`
	Service     string `json:"service"`
	Operation   string `json:"operation"`
	Query       string `json:"query"`
	Tags        string `json:"tags"`
	MinDuration string `json:"minDuration"`
	MaxDuration string `json:"maxDuration"`
	Limit       int    `json:"limit"`
}

func queryData(ctx context.Context, dsInfo *datasourceInfo, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	response := backend.NewQueryDataResponse()
	logger := dsInfo.JaegerClient.logger.FromContext(ctx)

	for _, q := range req.Queries {
		var query JaegerQuery

		err := json.Unmarshal(q.JSON, &query)
		if err != nil {
			err = backend.DownstreamError(fmt.Errorf("error while parsing the query json. %w", err))
			response.Responses[q.RefID] = backend.ErrorResponseWithErrorSource(err)
			continue
		}

		// Handle "Upload" query type
		if query.QueryType == "upload" {
			logger.Debug("upload query type is not supported in backend mode")
			response.Responses[q.RefID] = backend.DataResponse{
				Error:       fmt.Errorf("unsupported query type %s. only available in frontend mode", query.QueryType),
				ErrorSource: backend.ErrorSourceDownstream,
			}
			continue
		}

		// Handle "Search" query type
		// TODO: migrate this to use gRPC feature toggle
		useGrpc := true
		if query.QueryType == "search" {
			var frames *data.Frame
			var err error
			if useGrpc {
				// call grpc client search function
				frames, err = dsInfo.JaegerClient.GrpcSearch(&query, q.TimeRange.From, q.TimeRange.To)
			} else {
				frames, err = dsInfo.JaegerClient.Search(&query, q.TimeRange.From.UnixMicro(), q.TimeRange.To.UnixMicro())
			}
			if err != nil {
				response.Responses[q.RefID] = backend.ErrorResponseWithErrorSource(err)
				continue
			}
			response.Responses[q.RefID] = backend.DataResponse{
				Frames: data.Frames{frames},
			}
		}

		// No query type means traceID query
		if query.QueryType == "" {
			frame, err := dsInfo.JaegerClient.Trace(ctx, query.Query, q.TimeRange.From.UnixMilli(), q.TimeRange.To.UnixMilli(), q.RefID)
			if err != nil {
				response.Responses[q.RefID] = backend.ErrorResponseWithErrorSource(err)
				continue
			}
			response.Responses[q.RefID] = backend.DataResponse{
				Frames: []*data.Frame{frame},
			}
		}

		if query.QueryType == "dependencyGraph" {
			dependencies, err := dsInfo.JaegerClient.Dependencies(ctx, q.TimeRange.From.UnixMilli(), q.TimeRange.To.UnixMilli())
			if err != nil {
				response.Responses[q.RefID] = backend.ErrorResponseWithErrorSource(err)
				continue
			}

			if len(dependencies.Errors) > 0 {
				response.Responses[q.RefID] = backend.ErrorResponseWithErrorSource(backend.DownstreamError(fmt.Errorf("error while fetching dependencies, code: %v, message: %v", dependencies.Errors[0].Code, dependencies.Errors[0].Msg)))
				continue
			}
			frames := transformDependenciesResponse(dependencies, q.RefID)
			response.Responses[q.RefID] = backend.DataResponse{
				Frames: frames,
			}
		}
	}

	return response, nil
}

func transformDependenciesResponse(dependencies types.DependenciesResponse, refID string) []*data.Frame {
	// Create nodes frame
	nodesFrame := data.NewFrame(refID+"_nodes",
		data.NewField("id", nil, []string{}),
		data.NewField("title", nil, []string{}),
	)
	nodesFrame.Meta = &data.FrameMeta{
		PreferredVisualization: "nodeGraph",
	}

	// Create edges frame
	mainStatField := data.NewField("mainstat", nil, []int64{})
	mainStatField.Config = &data.FieldConfig{
		DisplayName: "Call count",
	}
	edgesFrame := data.NewFrame(refID+"_edges",
		data.NewField("id", nil, []string{}),
		data.NewField("source", nil, []string{}),
		data.NewField("target", nil, []string{}),
		mainStatField,
	)

	edgesFrame.Meta = &data.FrameMeta{
		PreferredVisualization: "nodeGraph",
	}

	// Return early if there are no dependencies
	if len(dependencies.Data) == 0 {
		return []*data.Frame{nodesFrame, edgesFrame}
	}

	// Create a map to store unique service nodes
	servicesByName := make(map[string]bool)

	// Process each dependency
	for _, dependency := range dependencies.Data {
		// Add services to the map to track unique services
		servicesByName[dependency.Parent] = true
		servicesByName[dependency.Child] = true

		// Add edge data
		edgesFrame.AppendRow(
			dependency.Parent+"--"+dependency.Child,
			dependency.Parent,
			dependency.Child,
			int64(dependency.CallCount),
		)
	}

	// Convert map keys to slice and sort them - this is to ensure the returned nodes are in a consistent order
	services := make([]string, 0, len(servicesByName))
	for service := range servicesByName {
		services = append(services, service)
	}
	sort.Strings(services)

	// Add node data in sorted order
	for _, service := range services {
		nodesFrame.AppendRow(
			service,
			service,
		)
	}

	return []*data.Frame{nodesFrame, edgesFrame}
}
