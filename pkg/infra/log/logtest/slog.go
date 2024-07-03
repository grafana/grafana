package logtest

import (
	"context"
	"log/slog"
	"strings"
	"testing"
)

type NopHandler struct{}

func NewNopHandler(t *testing.T) *NopHandler {
	return &NopHandler{}
}
func (h *NopHandler) Enabled(_ context.Context, _ slog.Level) bool  { return false }
func (h *NopHandler) WithAttrs(_ []slog.Attr) slog.Handler          { return h }
func (h *NopHandler) WithGroup(_ string) slog.Handler               { return h }
func (h *NopHandler) Handle(_ context.Context, r slog.Record) error { return nil }

type TestHandler struct {
	t *testing.T
}

func NewTestHandler(t *testing.T) *TestHandler {
	return &TestHandler{t: t}
}

func (th *TestHandler) Enabled(_ context.Context, _ slog.Level) bool { return true }
func (th *TestHandler) WithAttrs(_ []slog.Attr) slog.Handler         { return th }
func (th *TestHandler) WithGroup(_ string) slog.Handler              { return th }
func (th *TestHandler) Handle(ctx context.Context, r slog.Record) error {
	th.t.Helper()
	buf := &strings.Builder{}
	h := slog.NewTextHandler(buf, nil)
	err := h.Handle(ctx, r)
	if err != nil {
		return err
	}
	th.t.Log(buf.String())
	return nil
}
