package utils

import (
	"fmt"
	"sort"
	"strconv"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/tsdb/jaeger/types"
)

func TransformGrpcSearchResponse(response types.GrpcTracesResult, dsUID string, dsName string) *data.Frame {
	// Create a frame for the traces
	frame := data.NewFrame("traces",
		data.NewField("traceID", nil, []string{}).SetConfig(&data.FieldConfig{
			DisplayName: "Trace ID",
			Links: []data.DataLink{
				{
					Title: "Trace: ${__value.raw}",
					URL:   "",
					Internal: &data.InternalDataLink{
						DatasourceUID:  dsUID,
						DatasourceName: dsName,
						Query: map[string]interface{}{
							"query": "${__value.raw}",
						},
					},
				},
			},
		}),
		data.NewField("traceName", nil, []string{}).SetConfig(&data.FieldConfig{
			DisplayName: "Trace name",
		}),
		data.NewField("startTime", nil, []time.Time{}).SetConfig(&data.FieldConfig{
			DisplayName: "Start time",
		}),
		data.NewField("duration", nil, []int64{}).SetConfig(&data.FieldConfig{
			DisplayName: "Duration",
			Unit:        "µs",
		}),
	)

	// Set the visualization type to table
	frame.Meta = &data.FrameMeta{
		PreferredVisualization: "table",
	}

	// Sort traces by start time in descending order (newest first)
	resourceSpans := response.ResourceSpans
	sort.Slice(resourceSpans, func(i, j int) bool {
		rootSpanI := resourceSpans[i].ScopeSpans[0].Spans[0]
		rootSpanJ := resourceSpans[j].ScopeSpans[0].Spans[0]

		for _, scopeSpan := range resourceSpans[i].ScopeSpans {
			for _, span := range scopeSpan.Spans {
				if span.StartTimeUnixNano < rootSpanI.StartTimeUnixNano {
					rootSpanI = span
				}
			}
		}

		for _, scopeSpan := range resourceSpans[j].ScopeSpans {
			for _, span := range scopeSpan.Spans {
				if span.StartTimeUnixNano < rootSpanJ.StartTimeUnixNano {
					rootSpanJ = span
				}
			}
		}

		return rootSpanI.StartTimeUnixNano > rootSpanJ.StartTimeUnixNano
	})

	// process each individual resource
	for _, res := range resourceSpans {
		serviceName := getAttribute(res.Resource.Attributes, "service.name")
		for _, scopeSpan := range res.ScopeSpans {
			if len(scopeSpan.Spans) == 0 {
				continue
			}

			// Get the root span
			rootSpan := scopeSpan.Spans[0]
			for _, span := range scopeSpan.Spans {
				if span.StartTimeUnixNano < rootSpan.StartTimeUnixNano {
					rootSpan = span
				}
			}

			// get trace name
			traceName := fmt.Sprintf("%s: %s", serviceName.StringValue, scopeSpan.Scope.Name)
			startTimeInt, startErr := strconv.ParseInt(rootSpan.StartTimeUnixNano, 10, 64)
			endTimeInt, endErr := strconv.ParseInt(rootSpan.EndTimeUnixNano, 10, 64)
			duration := int64(0)
			if startErr == nil && endErr == nil {
				duration = endTimeInt - startTimeInt
			}

			frame.AppendRow(
				rootSpan.TraceID,
				traceName,
				time.Unix(0, startTimeInt),
				duration,
			)
		}
	}

	return frame
}

func getAttribute(attributes []types.GrpcKeyValue, attName string) types.GrpcAnyValue {
	var attValue types.GrpcAnyValue
	for _, att := range attributes {
		if att.Key == attName {
			return att.Value
		}
	}

	return attValue
}
