package service

import (
	"context"
	"fmt"
	"github.com/grafana/grafana/pkg/components/imguploader"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/dashboardimage"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/setting"
	"net/url"
	path2 "path"
	"strconv"
)

type DashboardImageService struct {
	cfg                  *setting.Cfg
	log                  log.Logger
	dashboardService     dashboards.DashboardService
	renderService        rendering.Service
	imageUploaderService imguploader.ImageUploader
}

func ProvideService(cfg *setting.Cfg, ds dashboards.DashboardService, rs rendering.Service) (*DashboardImageService, error) {
	us, err := imguploader.NewImageUploader(cfg)
	if err != nil {
		return nil, err
	}

	return &DashboardImageService{
		cfg:                  cfg,
		log:                  log.New("dashboardimage.service"),
		dashboardService:     ds,
		renderService:        rs,
		imageUploaderService: us,
	}, nil
}

func (d *DashboardImageService) TakeScreenshotAndUpload(ctx context.Context, opts dashboardimage.ScreenshotOptions) (string, error) {
	q := dashboards.GetDashboardQuery{OrgID: opts.OrgID, UID: opts.DashboardUID}
	dashboard, err := d.dashboardService.GetDashboard(ctx, &q)
	if err != nil {
		return "", err
	}

	//opts = opts.SetDefaults()

	u := url.URL{}
	urlPath := "d-solo"
	if opts.PanelID == 0 {
		urlPath = "d"
	}
	u.Path = path2.Join(urlPath, dashboard.UID, dashboard.Slug)
	p := u.Query()
	p.Add("orgId", strconv.FormatInt(dashboard.OrgID, 10))
	p.Add("panelId", strconv.FormatInt(opts.PanelID, 10))
	if opts.From != "" && opts.To != "" {
		p.Add("from", opts.From)
		p.Add("to", opts.To)
	}
	if opts.PanelID == 0 {
		p.Add("fullPageImage", "true")
		p.Add("kiosk", "true")
	}
	u.RawQuery = p.Encode()

	renderOpts := rendering.Opts{
		AuthOpts: opts.AuthOptions,
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
		ConcurrentLimit: d.cfg.RendererConcurrentRequestLimit,
		Path:            u.String(),
	}

	result, err := d.renderService.Render(ctx, rendering.RenderPNG, renderOpts, nil)
	if err != nil {
		return "", fmt.Errorf("failed to take screenshot: %w", err)
	}

	path, err := d.imageUploaderService.Upload(ctx, result.FilePath)
	if err != nil {
		return "", err
	}

	return path, nil
}
