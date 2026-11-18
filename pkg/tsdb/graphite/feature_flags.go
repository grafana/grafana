package graphite

import (
	"cmp"
	"context"
	"errors"
	"maps"
	"sync"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/config"
	"github.com/open-feature/go-sdk-contrib/providers/ofrep"
	"github.com/open-feature/go-sdk/openfeature"
	"golang.org/x/sync/singleflight"
)

const flagStreamingRenderDecoder = "graphite.streaming-render-decoder"

const (
	ofrepRequestTimeout  = 5 * time.Second
	ofrepDefaultCacheTTL = time.Minute
)

// booleanFlagEvaluator evaluates boolean feature flags, as *openfeature.Client does.
type booleanFlagEvaluator interface {
	BooleanValue(ctx context.Context, flag string, defaultValue bool, evalCtx openfeature.EvaluationContext, options ...openfeature.Option) (bool, error)
}

// streamingRenderDecoderEnabled evaluates flagStreamingRenderDecoder for the
// request's namespace. Any discovery or evaluation error turns it off.
func (s *Service) streamingRenderDecoderEnabled(ctx context.Context, pluginCtx backend.PluginContext) bool {
	of, err := config.GrafanaConfigFromContext(ctx).OpenFeature()
	if err != nil && !errors.Is(err, config.ErrOpenFeatureNotConfigured) {
		return false
	}
	evalCtx := flagEvaluationContext(pluginCtx, of.ContextAttrs)
	// Plugins can call only an OFREP host endpoint without credentials. Other hosts
	// answer through the process's own provider, a no-op in a standalone plugin.
	if of.ProviderType == "ofrep" {
		return s.ofrep.isEnabled(ctx, s.logger, of, flagStreamingRenderDecoder, evalCtx)
	}
	flags := s.flags
	if flags == nil {
		flags = openfeature.NewDefaultClient()
	}
	enabled, err := flags.BooleanValue(ctx, flagStreamingRenderDecoder, false, evalCtx)
	return err == nil && enabled
}

// flagEvaluationContext sets the plugin namespace as the targeting key and the namespace
// attribute, then adds the host's OpenFeature context attributes, which win on a name clash.
func flagEvaluationContext(pluginCtx backend.PluginContext, hostAttrs map[string]string) openfeature.EvaluationContext {
	namespace := cmp.Or(pluginCtx.Namespace, hostAttrs["namespace"])
	attrs := make(map[string]any, len(hostAttrs)+1)
	if namespace != "" {
		attrs["namespace"] = namespace
	}
	for k, v := range hostAttrs {
		attrs[k] = v
	}
	return openfeature.NewEvaluationContext(namespace, attrs)
}

// ofrepFlags evaluates flags against the host's OFREP endpoint and caches each
// answer for the host's TTL. A failed request keeps the previous answer.
type ofrepFlags struct {
	group     singleflight.Group
	mu        sync.Mutex
	providers map[string]*ofrep.Provider
	answers   map[string]ofrepAnswer
}

type ofrepAnswer struct {
	enabled bool
	expires time.Time
}

func newOFREPFlags() *ofrepFlags {
	return &ofrepFlags{providers: map[string]*ofrep.Provider{}, answers: map[string]ofrepAnswer{}}
}

func (f *ofrepFlags) isEnabled(ctx context.Context, logger log.Logger, of config.OpenFeatureConfig, flag string, evalCtx openfeature.EvaluationContext) bool {
	key := flag + "|" + of.URL + "|" + evalCtx.TargetingKey()
	if a, fresh := f.answer(key); fresh {
		return a.enabled
	}
	v, _, _ := f.group.Do(key, func() (any, error) {
		if a, fresh := f.answer(key); fresh {
			return a, nil
		}
		flat := openfeature.FlattenedContext{openfeature.TargetingKey: evalCtx.TargetingKey()}
		maps.Copy(flat, evalCtx.Attributes())
		// Every caller in the TTL window shares the answer, so one caller's cancellation must not fail it.
		detail := f.provider(of.URL).BooleanEvaluation(context.WithoutCancel(ctx), flag, false, flat)

		f.mu.Lock()
		defer f.mu.Unlock()
		a := f.answers[key]
		if detail.Reason == openfeature.ErrorReason {
			logger.Warn("Feature flag evaluation failed", "flag", flag, "error", detail.ResolutionError.Error())
		} else {
			a.enabled = detail.Value
		}
		a.expires = time.Now().Add(cmp.Or(of.CacheTTL, ofrepDefaultCacheTTL))
		f.answers[key] = a
		return a, nil
	})
	a, _ := v.(ofrepAnswer)
	return a.enabled
}

func (f *ofrepFlags) answer(key string) (ofrepAnswer, bool) {
	f.mu.Lock()
	defer f.mu.Unlock()
	a, ok := f.answers[key]
	return a, ok && time.Now().Before(a.expires)
}

func (f *ofrepFlags) provider(url string) *ofrep.Provider {
	f.mu.Lock()
	defer f.mu.Unlock()
	p, ok := f.providers[url]
	if !ok {
		p = ofrep.NewProvider(url, ofrep.WithTimeout(ofrepRequestTimeout))
		f.providers[url] = p
	}
	return p
}
