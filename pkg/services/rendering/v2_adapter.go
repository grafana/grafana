package rendering

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/grafana/grafana/pkg/configprovider"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	renderingv2 "github.com/grafana/grafana/pkg/services/rendering/v2"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	renderingV2ResponseBytesMax int64 = 1 << 30
)

type v2Adapter struct {
	service *renderingv2.Service
	files   *renderingv2.FileSink
	cfg     *setting.Cfg
}

func newV2Adapter(
	cfg *setting.Cfg,
	cfgProvider configprovider.ConfigProvider,
	features featuremgmt.FeatureToggles,
	remoteCache *remotecache.RemoteCache,
) (*v2Adapter, error) {
	if cfgProvider == nil {
		return nil, errors.New("create rendering v2 adapter: configuration provider is required")
	}

	var authenticator renderingv2.CallbackAuthenticator
	if features.IsEnabledGlobally(featuremgmt.FlagRenderAuthJWT) { //nolint:staticcheck // legacy rollout toggle
		authenticator = renderingv2.NewJWTRenderKeyAuthenticator()
	} else {
		if remoteCache == nil {
			return nil, errors.New("create rendering v2 adapter: remote cache is required for render key authentication")
		}
		var err error
		authenticator, err = renderingv2.NewCachedRenderKeyAuthenticator(remoteCache)
		if err != nil {
			return nil, err
		}
	}

	limits, err := renderingv2.ParseLimits(renderingv2.LimitsInput{
		ResponseBytes: renderingV2ResponseBytesMax,
	})
	if err != nil {
		return nil, err
	}
	service, err := renderingv2.NewService(v2ConfigurationProvider{provider: cfgProvider}, authenticator, limits)
	if err != nil {
		return nil, err
	}
	files, err := renderingv2.NewFileSink(renderingv2.FileSinkInput{
		ImagesDirectory: cfg.ImagesDir,
		CSVsDirectory:   cfg.CSVsDir,
		PDFsDirectory:   cfg.PDFsDir,
	})
	if err != nil {
		return nil, err
	}
	return &v2Adapter{service: service, files: files, cfg: cfg}, nil
}

type v2ConfigurationProvider struct {
	provider configprovider.ConfigProvider
}

func (p v2ConfigurationProvider) Get(ctx context.Context) (renderingv2.Configuration, error) {
	cfg, err := p.provider.Get(ctx)
	if err != nil {
		return renderingv2.Configuration{}, err
	}
	if cfg == nil {
		return renderingv2.Configuration{}, errors.New("configuration provider returned nil configuration")
	}
	return renderingv2.ParseConfiguration(renderingv2.ConfigurationInput{
		RendererServerURL:   cfg.RendererServerUrl,
		RendererCallbackURL: cfg.RendererCallbackUrl,
		RendererAuthToken:   cfg.RendererAuthToken,
		RendererCACertPath:  cfg.RendererCACert,
		RenderKeyLifetime:   cfg.RendererRenderKeyLifeTime,
		BuildVersion:        cfg.BuildVersion,
		AppURL:              cfg.AppURL,
		HTTPAddress:         cfg.HTTPAddr,
		HTTPPort:            cfg.HTTPPort,
		Protocol:            string(cfg.Protocol),
		AppSubURL:           cfg.AppSubURL,
		ServeFromSubPath:    cfg.ServeFromSubPath,
	})
}

func (a *v2Adapter) Run(ctx context.Context) error {
	return a.service.Run(ctx)
}

func (a *v2Adapter) IsAvailable(ctx context.Context) bool {
	available, err := a.service.IsAvailable(ctx)
	return err == nil && available
}

func (a *v2Adapter) Version() string {
	return a.service.Version()
}

func (a *v2Adapter) RenderErrorImage(theme models.Theme, renderError error) (*RenderResult, error) {
	if theme == "" {
		theme = models.ThemeDark
	}
	name := "error"
	if errors.Is(renderError, ErrTimeout) || errors.Is(renderError, ErrServerTimeout) {
		name = "timeout"
	}
	path := filepath.Join(a.cfg.HomePath, fmt.Sprintf("public/img/rendering_%s_%s.png", name, theme))
	if _, err := os.Stat(path); errors.Is(err, os.ErrNotExist) {
		return nil, err
	}
	return &RenderResult{FilePath: path}, nil
}

func (a *v2Adapter) Render(ctx context.Context, renderType RenderType, opts Opts) (*RenderResult, error) {
	started := time.Now()
	request, err := parseV2Request(renderType, opts.CommonOpts, opts.Width, opts.Height, opts.DeviceScaleFactor)
	if err != nil {
		saveMetrics(time.Since(started).Milliseconds(), err, renderType)
		return nil, err
	}
	result, err := a.service.Render(ctx, request)
	if err != nil {
		err = mapV2Error(err)
		if errors.Is(err, ErrRenderUnavailable) && !opts.ErrorRenderUnavailable {
			saveMetrics(time.Since(started).Milliseconds(), nil, renderType)
			return &RenderResult{FilePath: filepath.Join(a.cfg.HomePath, "public/img/rendering_plugin_not_installed.png")}, nil
		}
		if errors.Is(err, ErrConcurrentLimitReached) && !opts.ErrorConcurrentLimitReached {
			theme := opts.Theme
			if theme == "" {
				theme = models.ThemeDark
			}
			saveMetrics(time.Since(started).Milliseconds(), nil, renderType)
			return &RenderResult{FilePath: filepath.Join(a.cfg.HomePath, fmt.Sprintf("public/img/rendering_limit_%s.png", theme))}, nil
		}
		saveMetrics(time.Since(started).Milliseconds(), err, renderType)
		return nil, err
	}

	fileResult, writeErr := a.files.Write(result)
	closeErr := result.Close()
	if errors.Is(writeErr, context.DeadlineExceeded) {
		err = ErrTimeout
	} else if writeErr != nil {
		err = writeErr
	} else if closeErr != nil {
		err = closeErr
	}
	saveMetrics(time.Since(started).Milliseconds(), err, renderType)
	if err != nil {
		return nil, err
	}
	return &RenderResult{FilePath: fileResult.Path()}, nil
}

func (a *v2Adapter) RenderCSV(ctx context.Context, opts CSVOpts) (*RenderCSVResult, error) {
	started := time.Now()
	request, err := parseV2Request(RenderCSV, opts.CommonOpts, 0, 0, 0)
	if err != nil {
		saveMetrics(time.Since(started).Milliseconds(), err, RenderCSV)
		return nil, err
	}
	result, err := a.service.Render(ctx, request)
	if err != nil {
		err = mapV2Error(err)
		saveMetrics(time.Since(started).Milliseconds(), err, RenderCSV)
		return nil, err
	}
	fileResult, writeErr := a.files.Write(result)
	closeErr := result.Close()
	if errors.Is(writeErr, context.DeadlineExceeded) {
		err = ErrTimeout
	} else if writeErr != nil {
		err = writeErr
	} else if closeErr != nil {
		err = closeErr
	}
	saveMetrics(time.Since(started).Milliseconds(), err, RenderCSV)
	if err != nil {
		return nil, err
	}
	fileName, _ := fileResult.FileName()
	return &RenderCSVResult{FilePath: fileResult.Path(), FileName: fileName}, nil
}

func parseV2Request(renderType RenderType, opts CommonOpts, width, height int, scale float64) (renderingv2.Request, error) {
	return renderingv2.ParseRequest(renderingv2.RequestInput{
		RenderType:               renderingv2.RenderType(renderType),
		Path:                     opts.Path,
		Timezone:                 opts.Timezone,
		Timeout:                  opts.Timeout,
		RequestTimeoutMultiplier: opts.RequestTimeoutMultiplier,
		ConcurrentLimit:          opts.ConcurrentLimit,
		Width:                    width,
		Height:                   height,
		DeviceScale:              scale,
		Headers:                  opts.Headers,
		OrgID:                    opts.OrgID,
		UserID:                   opts.UserID,
		OrgRole:                  string(opts.OrgRole),
	})
}

func (a *v2Adapter) GetRenderUser(ctx context.Context, key string) (*RenderUser, bool) {
	user, found := a.service.AuthenticateRenderKey(ctx, key)
	if !found {
		return nil, false
	}
	return &RenderUser{OrgID: user.OrgID, UserID: user.UserID, OrgRole: user.OrgRole}, true
}

func (a *v2Adapter) HasCapability(ctx context.Context, capability CapabilityName) (CapabilitySupportRequestResult, error) {
	support, err := a.service.HasCapability(ctx, renderingv2.Capability(capability))
	return CapabilitySupportRequestResult{
		IsSupported:      support.Supported,
		SemverConstraint: support.SemverConstraint,
	}, mapV2Error(err)
}

func (a *v2Adapter) IsCapabilitySupported(ctx context.Context, capability CapabilityName) error {
	return mapV2Error(a.service.IsCapabilitySupported(ctx, renderingv2.Capability(capability)))
}

func mapV2Error(err error) error {
	switch {
	case err == nil:
		return nil
	case errors.Is(err, renderingv2.ErrRenderingUnavailable):
		return ErrRenderUnavailable
	case errors.Is(err, renderingv2.ErrConcurrentLimitReached):
		return ErrConcurrentLimitReached
	case errors.Is(err, renderingv2.ErrServerTimeout):
		return ErrServerTimeout
	case errors.Is(err, renderingv2.ErrTooManyRequests):
		return ErrTooManyRequests
	case errors.Is(err, renderingv2.ErrCapabilityUnknown):
		return ErrUnknownCapability
	case errors.Is(err, renderingv2.ErrRendererVersionInvalid):
		return ErrInvalidPluginVersion
	default:
		return err
	}
}
