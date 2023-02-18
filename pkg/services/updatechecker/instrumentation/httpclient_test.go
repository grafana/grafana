package instrumentation

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana/pkg/infra/tracing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/codes"
)

func TestHTTPClientTracing(t *testing.T) {
	tracer := tracing.NewFakeTracer()
	cl := NewInstrumentedHTTPClient(http.DefaultClient, tracer)
	srv := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {

	}))
	t.Cleanup(srv.Close)
	resp, err := cl.Get(context.Background(), srv.URL)
	defer func() { _ = resp.Body.Close() }()
	require.NoError(t, err)
	require.NotNil(t, resp)

	require.Len(t, tracer.Spans, 1, "tracer must have started 1 span")
	span := tracer.Spans[0]
	assert.True(t, span.IsEnded(), "span should hae ended")
	assert.Equal(t, codes.Unset, span.StatusCode, "span should have unset status code")
	assert.NoError(t, span.Err, "span should have no error")
}
