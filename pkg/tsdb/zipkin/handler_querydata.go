package zipkin

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/openzipkin/zipkin-go/model"
)

func queryData(ctx context.Context, dsInfo *datasourceInfo, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	response := backend.NewQueryDataResponse()
	logger := dsInfo.ZipkinClient.logger.FromContext(ctx)

	for _, q := range req.Queries {
		query, err := loadQuery(q)
		if err != nil {
			es := backend.ErrorSourcePlugin
			if backend.IsDownstreamError(err) {
				es = backend.ErrorSourceDownstream
			}
			response.Responses[q.RefID] = backend.DataResponse{
				Error:       err,
				ErrorSource: es,
			}
			continue
		}

		switch query.QueryType {
		case zipkinQueryTypeUpload:
			logger.Debug("upload query type is not supported in backend mode")
			response.Responses[q.RefID] = backend.DataResponse{
				Error:       fmt.Errorf("unsupported query type %s. only available in frontend mode", query.QueryType),
				ErrorSource: backend.ErrorSourcePlugin,
			}
		default:
			traces, err := dsInfo.ZipkinClient.Trace(query.Query)
			if err != nil {
				es := backend.ErrorSourcePlugin
				if backend.IsDownstreamHTTPError(err) {
					es = backend.ErrorSourceDownstream
				}
				response.Responses[q.RefID] = backend.DataResponse{
					Error:       err,
					ErrorSource: es,
				}
				continue
			}

			frame := transformResponse(traces, q.RefID)
			response.Responses[q.RefID] = backend.DataResponse{
				Frames: []*data.Frame{frame},
			}
		}
	}
	return response, nil
}

type zipkinQueryType string

const (
	zipkinQueryTypeTraceId zipkinQueryType = "traceID"
	zipkinQueryTypeUpload  zipkinQueryType = "upload"
)

type zipkinQuery struct {
	Query     string          `json:"query,omitempty"`
	QueryType zipkinQueryType `json:"queryType,omitempty"`
}

func loadQuery(backendQuery backend.DataQuery) (zipkinQuery, error) {
	var query zipkinQuery
	err := json.Unmarshal(backendQuery.JSON, &query)
	if err != nil {
		return query, backend.DownstreamError(fmt.Errorf("error while parsing the query json. %w", err))
	}
	return query, err
}

type TraceKeyValuePair struct {
	Key   string      `json:"key"`
	Value interface{} `json:"value"`
	Type  string      `json:"type,omitempty"`
}

type TraceLog struct {
	Timestamp int64
	Fields    []TraceKeyValuePair
}

func transformResponse(zipkinSpans []model.SpanModel, refId string) *data.Frame {
	newFrame := data.NewFrame(refId,
		data.NewField("traceID", nil, []string{}),
		data.NewField("spanID", nil, []string{}),
		data.NewField("parentSpanID", nil, []*string{}),
		data.NewField("operationName", nil, []string{}),
		data.NewField("serviceName", nil, []string{}),
		data.NewField("serviceTags", nil, []json.RawMessage{}),
		data.NewField("startTime", nil, []float64{}),
		data.NewField("duration", nil, []float64{}),
		data.NewField("logs", nil, []json.RawMessage{}),
		data.NewField("tags", nil, []json.RawMessage{}),
	)

	newFrame.Meta = &data.FrameMeta{
		PreferredVisualization: "trace",
		Custom: map[string]interface{}{
			"traceFormat": "zipkin",
		},
	}

	// go through each span and add to the frame
	for _, span := range zipkinSpans {
		var parentSpanIdString *string
		if span.ParentID != nil {
			s := span.ParentID.String()
			parentSpanIdString = &s
		}
		var serviceTags json.RawMessage
		serviceTagsMarshaled, err := json.Marshal(getServiceTags(span))
		if err == nil {
			serviceTags = json.RawMessage(serviceTagsMarshaled)
		}

		var logs json.RawMessage
		logsMarshaled, err := json.Marshal(transformAnnotationsToTraceLogs(span.Annotations))
		if err == nil {
			logs = json.RawMessage(logsMarshaled)
		}

		var tags json.RawMessage
		tagsMarshaled, err := json.Marshal(transformTags(span))
		if err == nil {
			tags = json.RawMessage(tagsMarshaled)
		}
		newFrame.AppendRow(
			span.TraceID.String(),
			span.ID.String(),
			parentSpanIdString,
			span.Name,
			getServiceName(span),
			serviceTags,
			float64(span.Timestamp.UnixMicro())/1000,
			float64(span.Duration.Microseconds())/1000,
			logs,
			tags,
		)
	}
	return newFrame
}

func getServiceName(span model.SpanModel) string {
	if span.LocalEndpoint != nil && span.LocalEndpoint.ServiceName != "" {
		return span.LocalEndpoint.ServiceName
	} else if span.RemoteEndpoint != nil && span.RemoteEndpoint.ServiceName != "" {
		return span.RemoteEndpoint.ServiceName
	}
	return "unknown"
}

func getServiceTags(span model.SpanModel) []TraceKeyValuePair {
	tags := make([]TraceKeyValuePair, 0, 4)
	endpoint := span.LocalEndpoint
	endpointType := "local"

	if endpoint == nil {
		endpoint = span.RemoteEndpoint
		endpointType = "remote"
	}

	if endpoint == nil {
		return tags
	}

	if endpoint.IPv4 != nil {
		tag := valueToTag("ipv4", endpoint.IPv4.String())
		tags = append(tags, tag)
	}

	if endpoint.IPv6 != nil {
		tag := valueToTag("ipv6", endpoint.IPv6.String())
		tags = append(tags, tag)
	}

	if endpoint.Port != 0 {
		tag := valueToTag("port", endpoint.Port)
		tags = append(tags, tag)
	}

	if endpointType != "" {
		tag := valueToTag("endpointType", endpointType)
		tags = append(tags, tag)
	}
	return tags
}

func valueToTag(key string, value interface{}) TraceKeyValuePair {
	return TraceKeyValuePair{
		Key:   key,
		Value: value,
	}
}

func transformAnnotationsToTraceLogs(annotations []model.Annotation) []TraceLog {
	transformed := make([]TraceLog, 0, len(annotations))
	if len(annotations) == 0 {
		return transformed
	}

	for _, annotation := range annotations {
		transformedAnnotation := TraceLog{
			Timestamp: annotation.Timestamp.UnixMicro(),
			Fields: []TraceKeyValuePair{
				{
					Key:   "annotation",
					Value: annotation.Value,
				},
			},
		}
		transformed = append(transformed, transformedAnnotation)
	}
	return transformed
}

func transformTags(span model.SpanModel) []TraceKeyValuePair {
	tags := make([]TraceKeyValuePair, 0, len(span.Tags)+2)

	for key, value := range span.Tags {
		if key == "error" {
			// Remap error tag to show error icon and include error details
			tags = append(tags, TraceKeyValuePair{
				Key:   "error",
				Value: true,
			})
			tags = append(tags, TraceKeyValuePair{
				Key:   "errorValue",
				Value: value,
			})
		} else {
			tags = append(tags, TraceKeyValuePair{
				Key:   key,
				Value: value,
			})
		}
	}

	// Prepend kind if present
	if span.Kind != "" {
		tags = append([]TraceKeyValuePair{{Key: "kind", Value: span.Kind}}, tags...)
	}

	// Prepend shared if present
	if span.Shared {
		tags = append([]TraceKeyValuePair{{Key: "shared", Value: span.Shared}}, tags...)
	}

	return tags
}
