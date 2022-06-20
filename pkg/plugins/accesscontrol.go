package plugins

import "github.com/grafana/grafana/pkg/services/accesscontrol"

var (
	AppReadAction    = "plugins.app:read"
	AppScopeProvider = accesscontrol.NewScopeProvider("plugins.app")
)
