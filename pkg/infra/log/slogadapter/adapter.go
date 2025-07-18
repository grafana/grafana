package slogadapter

import (
	"context"
	"log/slog"

	"github.com/grafana/grafana/pkg/infra/log"
)

var _ slog.Handler = &slogHandler{}

type slogHandler struct {
	log.Logger
}

func init() {
	// Lots of New's here: Default = slog.Logger <- slog.Handler <- infra/log.Logger
	slog.SetDefault(slog.New(New(log.New())))
}

// Provide is a helper method to be used with Wire, however most services should use slog.Default()
func Provide() slog.Handler { return New(log.New()) }

// NewSLogHandler returns a new slog.Handler that logs to the given log.Logger.
func New(logger log.Logger) *slogHandler {
	return &slogHandler{logger}
}

// Enabled implements slog.Handler.Enabled.
func (h *slogHandler) Enabled(_ context.Context, _ slog.Level) bool {
	return true
}

// Handle implements slog.Handler.Handle.
func (h *slogHandler) Handle(ctx context.Context, r slog.Record) error {
	attrs := make([]any, 0, 2*r.NumAttrs())
	fn := func(attr slog.Attr) bool {
		attrs = append(attrs, attr.Key, attr.Value)
		return true
	}
	r.Attrs(fn)
	attrs = append(attrs, log.FromContext(ctx)...)

	switch level := r.Level; {
	case level < slog.LevelInfo:
		h.Debug(r.Message, attrs...)
	case level < slog.LevelWarn:
		h.Info(r.Message, attrs...)
	case level < slog.LevelError:
		h.Warn(r.Message, attrs...)
	default:
		h.Error(r.Message, attrs...)
	}
	return nil
}

// WithAttrs implements slog.Handler.WithAttrs.
func (h *slogHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	out := make([]any, 0, 2*len(attrs))
	for _, attr := range attrs {
		out = append(out, attr.Key, attr.Value)
	}
	return New(h.New(out...))
}

// WithGroup implements slog.Handler.WithGroup.
func (h *slogHandler) WithGroup(name string) slog.Handler {
	if name == "" {
		return h
	}
	return New(h.New("group", name))
}
