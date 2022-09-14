package screenshot

import (
	"context"
	"fmt"
	"net/url"
	"path"
	"strconv"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/setting"
)

// CaptureService captures screenshots.
//
//go:generate mockgen -destination=capture_mock.go -package=screenshot github.com/grafana/grafana/pkg/services/screenshot CaptureService
type CaptureService interface {
	// Screenshot returns a screenshot of the panel. It returns an error if either
	// the panel, or the dashboard that contains the panel, does not exist, or the
	// screenshot could not be taken due to an error.
	Screenshot(ctx context.Context, opts ScreenshotOptions) (*Screenshot, error)
}

// HeadlessCaptureService takes screenshots using a headless browser.
type HeadlessCaptureService struct {
	ds dashboards.DashboardService
	rs rendering.Service
}

func NewHeadlessCaptureService(ds dashboards.DashboardService, rs rendering.Service) CaptureService {
	return &HeadlessCaptureService{
		ds: ds,
		rs: rs,
	}
}

// Screenshot returns a screenshot of the panel. It returns an error if either the panel,
// or the dashboard that contains the panel, does not exist, or the screenshot could not be
// taken due to an error. It uses both the context and the timeout in ScreenshotOptions,
// however the same context is used for both database queries and the request to the
// rendering service, while the timeout in ScreenshotOptions is passed to the rendering service
// where it is used as a client timeout. It is not recommended to pass a context without a deadline
// and the context deadline should be at least as long as the timeout in ScreenshotOptions.
func (s *HeadlessCaptureService) Screenshot(ctx context.Context, opts ScreenshotOptions) (*Screenshot, error) {
	q := models.GetDashboardQuery{Uid: opts.DashboardUID}
	if err := s.ds.GetDashboard(ctx, &q); err != nil {
		return nil, err
	}

	u := url.URL{}
	u.Path = path.Join("d-solo", q.Result.Uid, q.Result.Slug)
	p := u.Query()
	p.Add("orgId", strconv.FormatInt(q.Result.OrgId, 10))
	p.Add("panelId", strconv.FormatInt(opts.PanelID, 10))
	u.RawQuery = p.Encode()

	opts = opts.SetDefaults()
	renderOpts := rendering.Opts{
		AuthOpts: rendering.AuthOpts{
			OrgID:   q.Result.OrgId,
			OrgRole: org.RoleAdmin,
		},
		ErrorOpts: rendering.ErrorOpts{
			ErrorConcurrentLimitReached: true,
			ErrorRenderUnavailable:      true,
		},
		TimeoutOpts: rendering.TimeoutOpts{
			Timeout: opts.Timeout,
		},
		Width:           opts.Width,
		Height:          opts.Height,
		Theme:           opts.Theme,
		ConcurrentLimit: setting.AlertingRenderLimit,
		Path:            u.String(),
	}

	result, err := s.rs.Render(ctx, renderOpts, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to take screenshot: %w", err)
	}

	screenshot := Screenshot{Path: result.FilePath}
	return &screenshot, nil
}
