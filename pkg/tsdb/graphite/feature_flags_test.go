package graphite

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net/http"
	"net/http/httptest"
	"slices"
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

func withOpenFeatureConfig(ctx context.Context, providerType, url, contextJSON string) context.Context {
	return config.WithGrafanaConfig(ctx, config.NewGrafanaCfg(map[string]string{
		config.OpenFeatureProviderURL:  url,
		config.OpenFeatureProviderType: providerType,
		config.OpenFeatureContext:      contextJSON,
	}))
}

type fakeOFREP struct {
	mu       sync.Mutex
	status   int
	value    bool
	contexts []map[string]any
}

func (f *fakeOFREP) set(status int, value bool) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.status, f.value = status, value
}

func (f *fakeOFREP) requests() []map[string]any {
	f.mu.Lock()
	defer f.mu.Unlock()
	return slices.Clone(f.contexts)
}

func (f *fakeOFREP) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Context map[string]any `json:"context"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	f.mu.Lock()
	defer f.mu.Unlock()
	f.contexts = append(f.contexts, body.Context)
	w.WriteHeader(f.status)
	_, _ = fmt.Fprintf(w, `{"key":%q,"value":%t,"reason":"TARGETING_MATCH","variant":"v"}`, flagStreamingRenderDecoder, f.value)
}

func ofrepHost(t *testing.T) (*fakeOFREP, context.Context) {
	t.Helper()
	host := &fakeOFREP{status: http.StatusOK, value: true}
	mux := http.NewServeMux()
	mux.Handle("POST /ofrep/v1/evaluate/flags/"+flagStreamingRenderDecoder, host)
	server := httptest.NewServer(mux)
	t.Cleanup(server.Close)
	return host, withOpenFeatureConfig(context.Background(), "ofrep", server.URL, `{"slug":"mystack"}`)
}

func expireAnswers(f *ofrepFlags) {
	f.mu.Lock()
	defer f.mu.Unlock()
	for k, a := range f.answers {
		a.expires = time.Time{}
		f.answers[k] = a
	}
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

	for _, providerType := range []string{"features-service", "static"} {
		t.Run(providerType+" host: the process's provider targets the namespace with the host context attributes", func(t *testing.T) {
			flags := &fakeFlags{value: true}
			s := &Service{flags: flags}
			assert.True(t, s.streamingRenderDecoderEnabled(withOpenFeatureConfig(ctx, providerType, "http://flags.invalid", `{"slug":"mystack","stackId":"1"}`), pluginCtx))
			assert.Equal(t, "stacks-1", flags.evalCtx.TargetingKey())
			assert.Equal(t, map[string]any{"slug": "mystack", "stackId": "1"}, flags.evalCtx.Attributes())
		})
	}

	t.Run("falls back to the host namespace attribute", func(t *testing.T) {
		flags := &fakeFlags{value: true}
		s := &Service{flags: flags}
		assert.True(t, s.streamingRenderDecoderEnabled(withOpenFeatureConfig(ctx, "features-service", "http://flags.invalid", `{"namespace":"stacks-2"}`), backend.PluginContext{}))
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
		assert.False(t, s.streamingRenderDecoderEnabled(withOpenFeatureConfig(ctx, "ofrep", "http://flags.invalid", `not json`), pluginCtx))
	})
}

func TestStreamingRenderDecoderEnabledOverOFREP(t *testing.T) {
	pluginCtx := backend.PluginContext{Namespace: "stacks-1"}
	service := func() *Service {
		return &Service{logger: log.NewNullLogger(), flags: &fakeFlags{}, ofrep: newOFREPFlags()}
	}

	t.Run("evaluates against the host endpoint once per TTL", func(t *testing.T) {
		host, ctx := ofrepHost(t)
		s := service()
		assert.True(t, s.streamingRenderDecoderEnabled(ctx, pluginCtx))
		assert.True(t, s.streamingRenderDecoderEnabled(ctx, pluginCtx))
		assert.Equal(t, []map[string]any{{"targetingKey": "stacks-1", "slug": "mystack"}}, host.requests())
		assert.Zero(t, s.flags.(*fakeFlags).calls)
	})

	t.Run("caches per targeting key", func(t *testing.T) {
		host, ctx := ofrepHost(t)
		s := service()
		s.streamingRenderDecoderEnabled(ctx, pluginCtx)
		s.streamingRenderDecoderEnabled(ctx, backend.PluginContext{Namespace: "stacks-2"})
		assert.Len(t, host.requests(), 2)
	})

	t.Run("off when the host serves false", func(t *testing.T) {
		host, ctx := ofrepHost(t)
		host.set(http.StatusOK, false)
		assert.False(t, service().streamingRenderDecoderEnabled(ctx, pluginCtx))
	})

	t.Run("off when the first request fails", func(t *testing.T) {
		host, ctx := ofrepHost(t)
		host.set(http.StatusInternalServerError, true)
		assert.False(t, service().streamingRenderDecoderEnabled(ctx, pluginCtx))
	})

	t.Run("a failed refresh keeps the previous answer", func(t *testing.T) {
		host, ctx := ofrepHost(t)
		s := service()
		require.True(t, s.streamingRenderDecoderEnabled(ctx, pluginCtx))
		expireAnswers(s.ofrep)
		host.set(http.StatusInternalServerError, false)
		assert.True(t, s.streamingRenderDecoderEnabled(ctx, pluginCtx))
		assert.Len(t, host.requests(), 2)
	})

	t.Run("a cancelled caller still caches the answer", func(t *testing.T) {
		host, ctx := ofrepHost(t)
		s := service()
		cancelled, cancel := context.WithCancelCause(ctx)
		cancel(errors.New("query cancelled"))
		assert.True(t, s.streamingRenderDecoderEnabled(cancelled, pluginCtx))
		assert.True(t, s.streamingRenderDecoderEnabled(ctx, pluginCtx))
		assert.Len(t, host.requests(), 1)
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
