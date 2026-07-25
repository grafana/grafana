package jwt

import (
	"context"

	"github.com/grafana/grafana/pkg/setting"
)

type settingsCtxKey struct{}

// WithSettings stores a per-request snapshot of the JWT settings on the context
// so that authentication and outbound auth-header clearing observe the same
// values even if a reload changes them concurrently within a request.
func WithSettings(ctx context.Context, settings setting.AuthJWTSettings) context.Context {
	return context.WithValue(ctx, settingsCtxKey{}, settings)
}

// SettingsFromContext returns the JWT settings snapshot stored by WithSettings
// and whether one was present.
func SettingsFromContext(ctx context.Context) (setting.AuthJWTSettings, bool) {
	s, ok := ctx.Value(settingsCtxKey{}).(setting.AuthJWTSettings)
	return s, ok
}
