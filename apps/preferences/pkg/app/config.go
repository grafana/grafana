package app

import (
	v1 "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1"
)

// DefaultHomeDashboardName is the name preferences use for the home dashboard
// that comes from Grafana's configuration rather than from a dashboard.
const DefaultHomeDashboardName = "default-home-dashboard"

// Config is what the app needs from the Grafana running it.
type Config struct {
	// Defaults fill every field no user, team or namespace preference sets.
	Defaults v1.PreferencesSpec

	// HomeDashboardName is the Defaults.HomeDashboardUID value that stands for
	// the home dashboard in the configuration. Empty means DefaultHomeDashboardName.
	HomeDashboardName string

	// IsValidTheme reports whether a theme is configured. Without it, any
	// theme is accepted.
	IsValidTheme func(id string) bool
}

func (c *Config) homeDashboardName() string {
	if c.HomeDashboardName != "" {
		return c.HomeDashboardName
	}
	return DefaultHomeDashboardName
}
