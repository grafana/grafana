package middleware

import (
	macaron "gopkg.in/macaron.v1"

	m "github.com/grafana/grafana/pkg/models"
)

type AuthOptions struct {
	ReqGrafanaAdmin bool
	ReqSignedIn     bool
}

func getApiKey(c *m.ReqContext) string { return "" }

func EnsureEditorOrViewerCanEdit(c *m.ReqContext) {}

func RoleAuth(roles ...m.RoleType) macaron.Handler { return func(c *m.ReqContext) {} }

func Auth(options *AuthOptions) macaron.Handler { return func(c *m.ReqContext) {} }

func AdminOrFeatureEnabled(enabled bool) macaron.Handler { return func(c *m.ReqContext) {} }

func SnapshotPublicModeOrSignedIn() macaron.Handler {
	return func(c *m.ReqContext) {}
}
