package dashboardimage

import (
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/rendering"
	"time"
)

type ScreenshotOptions struct {
	AuthOptions   rendering.AuthOpts
	OrgID         int64
	DashboardUID  string
	DashboardSlug string

	// PanelID must be 0 or null if the screenshot is for the whole dashboard
	PanelID int64
	From    string
	To      string
	Width   int
	Height  int
	Theme   models.Theme
	Timeout time.Duration
}
