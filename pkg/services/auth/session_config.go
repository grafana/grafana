package auth

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/setting"
)

// SessionConfigResolver resolves a SessionConfig from context.
type SessionConfigResolver interface {
	Resolve(ctx context.Context) SessionConfig
}

// StaticSessionConfigResolver resolves from a static *setting.Cfg, rebuilding
// SessionConfig per call so post-construction mutations to cfg propagate.
type StaticSessionConfigResolver struct {
	Cfg *setting.Cfg
}

func (r *StaticSessionConfigResolver) Resolve(_ context.Context) SessionConfig {
	return NewSessionConfig(r.Cfg)
}

// SessionConfig is the per-request view of session-handling configuration.
type SessionConfig struct {
	LoginCookieName              string
	TokenRotationIntervalMinutes int
	LoginMaxLifetime             time.Duration
	LoginMaxInactiveLifetime     time.Duration
	SecretKey                    string
}

// NewSessionConfig builds a SessionConfig from a *setting.Cfg.
func NewSessionConfig(cfg *setting.Cfg) SessionConfig {
	return SessionConfig{
		LoginCookieName:              cfg.LoginCookieName,
		TokenRotationIntervalMinutes: cfg.TokenRotationIntervalMinutes,
		LoginMaxLifetime:             cfg.LoginMaxLifetime,
		LoginMaxInactiveLifetime:     cfg.LoginMaxInactiveLifetime,
		SecretKey:                    cfg.SecretKey,
	}
}
