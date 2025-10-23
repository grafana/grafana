// Code generated from semantic convention specification. DO NOT EDIT.

package grafanaconv

import (
	"context"
	"go.opentelemetry.io/otel/trace"
)

// Span names for Grafana semantic conventions
const (
	// PluginBootstrapSpanName is the span name for grafana.plugin.bootstrap
	//
	// Brief: Plugin bootstrap stage where individual plugins are bootstrapped
	// Span Kind: internal
	// Stability: stable
	PluginBootstrapSpanName = "grafana.plugin.bootstrap"

	// PluginDiscoverSpanName is the span name for grafana.plugin.discover
	//
	// Brief: Plugin discovery stage where plugins are found from a source
	// Span Kind: internal
	// Stability: stable
	PluginDiscoverSpanName = "grafana.plugin.discover"

	// PluginInitializeSpanName is the span name for grafana.plugin.initialize
	//
	// Brief: Plugin initialization stage where individual plugins are initialized
	// Span Kind: internal
	// Stability: stable
	PluginInitializeSpanName = "grafana.plugin.initialize"

	// PluginLoadSpanName is the span name for grafana.plugin.load
	//
	// Brief: Plugin loading operation that covers the entire plugin loading pipeline
	// Span Kind: internal
	// Stability: stable
	PluginLoadSpanName = "grafana.plugin.load"

	// PluginUnloadSpanName is the span name for grafana.plugin.unload
	//
	// Brief: Plugin unloading operation
	// Span Kind: internal
	// Stability: stable
	PluginUnloadSpanName = "grafana.plugin.unload"

	// PluginValidateSpanName is the span name for grafana.plugin.validate
	//
	// Brief: Plugin validation stage where individual plugins are validated
	// Span Kind: internal
	// Stability: stable
	PluginValidateSpanName = "grafana.plugin.validate"
)

// Span helper functions
// PluginBootstrapSpan creates a span for Plugin bootstrap stage where individual plugins are bootstrapped
func PluginBootstrapSpan(ctx context.Context, tracer trace.Tracer, opts ...trace.SpanStartOption) (context.Context, trace.Span) {
	return tracer.Start(ctx, PluginBootstrapSpanName, opts...)
}

// PluginDiscoverSpan creates a span for Plugin discovery stage where plugins are found from a source
func PluginDiscoverSpan(ctx context.Context, tracer trace.Tracer, opts ...trace.SpanStartOption) (context.Context, trace.Span) {
	return tracer.Start(ctx, PluginDiscoverSpanName, opts...)
}

// PluginInitializeSpan creates a span for Plugin initialization stage where individual plugins are initialized
func PluginInitializeSpan(ctx context.Context, tracer trace.Tracer, opts ...trace.SpanStartOption) (context.Context, trace.Span) {
	return tracer.Start(ctx, PluginInitializeSpanName, opts...)
}

// PluginLoadSpan creates a span for Plugin loading operation that covers the entire plugin loading pipeline
func PluginLoadSpan(ctx context.Context, tracer trace.Tracer, opts ...trace.SpanStartOption) (context.Context, trace.Span) {
	return tracer.Start(ctx, PluginLoadSpanName, opts...)
}

// PluginUnloadSpan creates a span for Plugin unloading operation
func PluginUnloadSpan(ctx context.Context, tracer trace.Tracer, opts ...trace.SpanStartOption) (context.Context, trace.Span) {
	return tracer.Start(ctx, PluginUnloadSpanName, opts...)
}

// PluginValidateSpan creates a span for Plugin validation stage where individual plugins are validated
func PluginValidateSpan(ctx context.Context, tracer trace.Tracer, opts ...trace.SpanStartOption) (context.Context, trace.Span) {
	return tracer.Start(ctx, PluginValidateSpanName, opts...)
}
