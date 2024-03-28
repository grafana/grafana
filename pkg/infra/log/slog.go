package log

import (
	"context"
	"log/slog"
)

var _ slog.Handler = &SLogHandler{}

type SLogHandler struct {
	Logger
}

// NewSLogHandler returns a SLogHandler with the given level.
func NewSLogHandler(logger Logger) *SLogHandler {
	return &SLogHandler{logger}
}

func (h *SLogHandler) Enabled(_ context.Context, level slog.Level) bool {
	return true
}

// Handle implements Handler.Handle.
func (h *SLogHandler) Handle(ctx context.Context, r slog.Record) error {
	attrs := []any{}
	fn := func(attr slog.Attr) bool {
		attrs = append(attrs, attr.Key, attr.Value)
		return true
	}
	r.Attrs(fn)
	switch r.Level {
	case slog.LevelDebug:
		h.Debug(r.Message, attrs...)
	case slog.LevelInfo:
		h.Info(r.Message, attrs...)
	case slog.LevelWarn:
		h.Warn(r.Message, attrs...)
	case slog.LevelError:
		h.Error(r.Message, attrs...)
	}
	return nil
}

// WithAttrs implements Handler.WithAttrs.
func (h *SLogHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	out := []any{}
	for _, attr := range attrs {
		out = append(out, attr.Key, attr.Value)
	}
	return NewSLogHandler(h.Logger.New(out...))
}

// WithGroup implements Handler.WithGroup.
func (h *SLogHandler) WithGroup(name string) slog.Handler {
	if name == "" {
		return h
	}
	return NewSLogHandler(h.Logger.New(name))
}
