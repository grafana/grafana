package dashboardimage

import (
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/rendering"
	"time"
)

type ScreenshotOptions struct {
	AuthOptions rendering.AuthOpts
	// OrgID and DashboardUID are required.
	OrgID        int64
	DashboardUID string

	// These are optional. From and To must both be set to take effect.
	// Width, Height, Theme and Timeout inherit their defaults from
	// DefaultWidth, DefaultHeight, DefaultTheme and DefaultTimeout.
	// PanelID must be 0 if the screenshot is for the whole dashboard
	PanelID int64
	From    string
	To      string
	Width   int
	Height  int
	Theme   models.Theme
	Timeout time.Duration
}
