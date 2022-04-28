package state

import (
	"context"
	"errors"
	"time"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/screenshot"
)

var (
	ErrNoDashboard = errors.New("no dashboard")
)

type screenshotFunc func(ctx context.Context, r *models.AlertRule) (*screenshot.Screenshot, error)

func NewScreenshotFunc(screenshotService screenshot.ScreenshotService) screenshotFunc {
	return func(ctx context.Context, r *models.AlertRule) (*screenshot.Screenshot, error) {
		if r.DashboardUID == nil {
			return nil, ErrNoDashboard
		}
		var panelID int64
		if r.PanelID != nil {
			panelID = *r.PanelID
		}
		return screenshotService.Take(ctx, screenshot.ScreenshotOptions{
			Timeout:      15 * time.Second,
			DashboardUID: *r.DashboardUID,
			PanelID:      panelID,
		})
	}
}
