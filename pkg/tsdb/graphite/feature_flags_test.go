package graphite

import (
	"context"
	"errors"
	"math"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/config"
	"github.com/open-feature/go-sdk/openfeature"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type fakeFlags struct {
	mu      sync.Mutex
	value   bool
	err     error
	calls   int
	flag    string
	evalCtx openfeature.EvaluationContext
}

func (f *fakeFlags) BooleanValue(_ context.Context, flag string, _ bool, evalCtx openfeature.EvaluationContext, _ ...openfeature.Option) (bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.calls++
	f.flag = flag
	f.evalCtx = evalCtx
	return f.value, f.err
}

func withOpenFeatureConfig(ctx context.Context, contextJSON string) context.Context {
	return config.WithGrafanaConfig(ctx, config.NewGrafanaCfg(map[string]string{
		config.OpenFeatureProviderURL:  "http://flags.example",
		config.OpenFeatureProviderType: "ofrep",
		config.OpenFeatureContext:      contextJSON,
	}))
}

func TestStreamingRenderDecoderEnabled(t *testing.T) {
	ctx := context.Background()
	pluginCtx := backend.PluginContext{Namespace: "stacks-1"}

	t.Run("off with the default client and no provider", func(t *testing.T) {
		s := &Service{}
		assert.False(t, s.streamingRenderDecoderEnabled(ctx, pluginCtx))
	})

	t.Run("off when the flag is false", func(t *testing.T) {
		flags := &fakeFlags{}
		s := &Service{flags: flags}
		assert.False(t, s.streamingRenderDecoderEnabled(ctx, pluginCtx))
		assert.Equal(t, "graphite.streaming-render-decoder", flags.flag)
	})

	t.Run("on when the flag is true", func(t *testing.T) {
		s := &Service{flags: &fakeFlags{value: true}}
		assert.True(t, s.streamingRenderDecoderEnabled(ctx, pluginCtx))
	})

	t.Run("off when evaluation fails", func(t *testing.T) {
		s := &Service{flags: &fakeFlags{value: true, err: errors.New("provider not ready")}}
		assert.False(t, s.streamingRenderDecoderEnabled(ctx, pluginCtx))
	})

	t.Run("targets the namespace with the host context attributes", func(t *testing.T) {
		flags := &fakeFlags{value: true}
		s := &Service{flags: flags}
		assert.True(t, s.streamingRenderDecoderEnabled(withOpenFeatureConfig(ctx, `{"slug":"mystack","stackId":"1"}`), pluginCtx))
		assert.Equal(t, "stacks-1", flags.evalCtx.TargetingKey())
		assert.Equal(t, map[string]any{"slug": "mystack", "stackId": "1"}, flags.evalCtx.Attributes())
	})

	t.Run("falls back to the host namespace attribute", func(t *testing.T) {
		flags := &fakeFlags{value: true}
		s := &Service{flags: flags}
		assert.True(t, s.streamingRenderDecoderEnabled(withOpenFeatureConfig(ctx, `{"namespace":"stacks-2"}`), backend.PluginContext{}))
		assert.Equal(t, "stacks-2", flags.evalCtx.TargetingKey())
	})

	t.Run("evaluates without host attributes when discovery is not configured", func(t *testing.T) {
		flags := &fakeFlags{value: true}
		s := &Service{flags: flags}
		assert.True(t, s.streamingRenderDecoderEnabled(ctx, pluginCtx))
		assert.Equal(t, "stacks-1", flags.evalCtx.TargetingKey())
		assert.Empty(t, flags.evalCtx.Attributes())
	})

	t.Run("off when host discovery is malformed", func(t *testing.T) {
		flags := &fakeFlags{value: true}
		s := &Service{flags: flags}
		assert.False(t, s.streamingRenderDecoderEnabled(withOpenFeatureConfig(ctx, `not json`), pluginCtx))
	})
}

func TestRunQueryStreamingRenderDecoderFlag(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`[{"target":"a","datapoints":[[+Inf,1609459200]]}]`))
	}))
	t.Cleanup(server.Close)

	query := func(refID string) backend.DataQuery {
		return backend.DataQuery{
			RefID:         refID,
			TimeRange:     backend.TimeRange{From: time.Unix(1609459200, 0), To: time.Unix(1609459260, 0)},
			MaxDataPoints: 100,
			JSON:          []byte(`{"target":"a"}`),
		}
	}
	run := func(t *testing.T, flags *fakeFlags) *backend.QueryDataResponse {
		t.Helper()
		s := &Service{logger: log.NewNullLogger(), flags: flags}
		req := &backend.QueryDataRequest{
			PluginContext: backend.PluginContext{Namespace: "stacks-1"},
			Queries:       []backend.DataQuery{query("A"), query("B")},
		}
		res, err := s.RunQuery(context.Background(), req, &datasourceInfo{URL: server.URL, HTTPClient: &http.Client{}})
		require.NoError(t, err)
		return res
	}

	t.Run("flag off keeps the buffered decoder", func(t *testing.T) {
		res := run(t, &fakeFlags{})
		require.Len(t, res.Responses, 1)
		for _, r := range res.Responses {
			require.Error(t, r.Error)
		}
	})

	t.Run("flag on uses the streaming decoder and evaluates once", func(t *testing.T) {
		flags := &fakeFlags{value: true}
		res := run(t, flags)
		assert.Equal(t, 1, flags.calls)
		require.Len(t, res.Responses, 2)
		for _, refID := range []string{"A", "B"} {
			r := res.Responses[refID]
			require.NoError(t, r.Error)
			require.Len(t, r.Frames, 1)
			v := r.Frames[0].Fields[1].At(0).(*float64)
			require.NotNil(t, v)
			assert.True(t, math.IsInf(*v, 1))
		}
	})
}
