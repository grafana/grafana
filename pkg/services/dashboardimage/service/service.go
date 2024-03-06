package service

import (
	"context"
	"fmt"
	"github.com/grafana/grafana/pkg/components/imguploader"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/dashboardimage"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/setting"
	"net/url"
	path2 "path"
	"strconv"
)

type DashboardImageService struct {
	cfg                  *setting.Cfg
	log                  log.Logger
	renderService        rendering.Service
	imageUploaderService imguploader.ImageUploader
}

func ProvideService(cfg *setting.Cfg, rs rendering.Service) (*DashboardImageService, error) {
	us, err := imguploader.NewImageUploader(cfg)
	if err != nil {
		return nil, err
	}

	return &DashboardImageService{
		cfg:                  cfg,
		log:                  log.New("dashboardimage.service"),
		renderService:        rs,
		imageUploaderService: us,
	}, nil
}

func (d *DashboardImageService) TakeScreenshotAndUpload(ctx context.Context, opts dashboardimage.ScreenshotOptions) (string, error) {
	u := url.URL{}
	u.Path = path2.Join("d", opts.DashboardUID, opts.DashboardSlug)
	p := u.Query()
	p.Add("orgId", strconv.FormatInt(opts.OrgID, 10))
	if opts.PanelID != 0 {
		p.Add("viewPanel", strconv.FormatInt(opts.PanelID, 10))
	}
	if opts.From != "" && opts.To != "" {
		p.Add("from", opts.From)
		p.Add("to", opts.To)
	}

	p.Add("fullPageImage", "true")
	p.Add("kiosk", "true")

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
