package graphite

import (
	"cmp"
	"context"
	"errors"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/config"
	"github.com/open-feature/go-sdk/openfeature"
)

const flagStreamingRenderDecoder = "graphite.streaming-render-decoder"

// booleanFlagEvaluator evaluates boolean feature flags, as *openfeature.Client does.
type booleanFlagEvaluator interface {
	BooleanValue(ctx context.Context, flag string, defaultValue bool, evalCtx openfeature.EvaluationContext, options ...openfeature.Option) (bool, error)
}

// streamingRenderDecoderEnabled evaluates flagStreamingRenderDecoder for the
// request's namespace. Any discovery or evaluation error turns it off.
func (s *Service) streamingRenderDecoderEnabled(ctx context.Context, pluginCtx backend.PluginContext) bool {
	evalCtx, err := flagEvaluationContext(ctx, pluginCtx)
	if err != nil {
		return false
	}
	flags := s.flags
	if flags == nil {
		flags = openfeature.NewDefaultClient()
	}
	enabled, err := flags.BooleanValue(ctx, flagStreamingRenderDecoder, false, evalCtx)
	return err == nil && enabled
}

// flagEvaluationContext targets the plugin namespace and adds the host's
// OpenFeature context attributes, because the global provider sets no targeting key.
func flagEvaluationContext(ctx context.Context, pluginCtx backend.PluginContext) (openfeature.EvaluationContext, error) {
	discovery, err := config.GrafanaConfigFromContext(ctx).OpenFeature()
	if err != nil && !errors.Is(err, config.ErrOpenFeatureNotConfigured) {
		return openfeature.EvaluationContext{}, err
	}
	attrs := make(map[string]any, len(discovery.ContextAttrs))
	for k, v := range discovery.ContextAttrs {
		attrs[k] = v
	}
	targetingKey := cmp.Or(pluginCtx.Namespace, discovery.ContextAttrs["namespace"])
	return openfeature.NewEvaluationContext(targetingKey, attrs), nil
}
