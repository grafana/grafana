package resource

import (
	"testing"

	"github.com/stretchr/testify/require"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestAnnotateListRequestUsesOriginalRequestProperties(t *testing.T) {
	req := &resourcepb.ListRequest{Options: &resourcepb.ListOptions{
		Key: &resourcepb.ResourceKey{
			Group: "dashboard.grafana.app", Resource: "dashboards", Namespace: "default",
		},
		Fields: []*resourcepb.Requirement{{Key: "metadata.namespace", Operator: "=", Values: []string{"default"}}},
		Labels: []*resourcepb.Requirement{{Key: "example.com/enabled", Operator: "exists"}},
	}}
	selectorType := listSelectorType(req)
	requestedLimit := req.GetLimit()
	filterSelectors(req)
	req.Limit = 500
	require.Equal(t, "none", listSelectorType(req))

	recorder := tracetest.NewSpanRecorder()
	provider := sdktrace.NewTracerProvider(sdktrace.WithSpanProcessor(recorder))
	_, span := provider.Tracer("test").Start(t.Context(), "list")
	annotateListRequest(span, listPathStoreAuthorizeFirst, selectorType, requestedLimit, req, &resourcepb.ListResponse{})
	span.End()

	spans := recorder.Ended()
	require.Len(t, spans, 1)
	foundSelectorType := false
	foundLimit := false
	for _, attr := range spans[0].Attributes() {
		switch string(attr.Key) {
		case "list.selectors":
			foundSelectorType = true
			require.Equal(t, "field_and_label", attr.Value.AsString())
		case "list.limit":
			foundLimit = true
			require.Equal(t, int64(0), attr.Value.AsInt64())
		}
	}
	require.True(t, foundSelectorType, "list.selectors span attribute missing")
	require.True(t, foundLimit, "list.limit span attribute missing")
}
