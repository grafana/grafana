package rendering

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/plugins/backendplugin/pluginextensionv2"
)

func (rs *RenderingService) renderViaPlugin(ctx context.Context, renderType RenderType, renderKey string, opts Opts) (*RenderResult, error) {
	logger := rs.log.FromContext(ctx)

	// gives plugin some additional time to timeout and return possible errors.
	ctx, cancel := context.WithTimeout(ctx, getRequestTimeout(opts.TimeoutOpts))
	defer cancel()

	filePath, err := rs.getNewFilePath(renderType)
	if err != nil {
		return nil, err
	}

	headers := map[string]*pluginextensionv2.StringList{}

	for k, values := range opts.Headers {
		headers[k] = &pluginextensionv2.StringList{
			Values: values,
		}
	}

	req := &pluginextensionv2.RenderRequest{
		Url:               rs.getGrafanaCallbackURL(opts.Path),
		Width:             int32(opts.Width),
		Height:            int32(opts.Height),
		DeviceScaleFactor: float32(opts.DeviceScaleFactor),
		FilePath:          filePath,
		Timeout:           int32(opts.Timeout.Seconds()),
		RenderKey:         renderKey,
		Timezone:          isoTimeOffsetToPosixTz(opts.Timezone),
		Domain:            rs.domain,
		Headers:           headers,
		AuthToken:         rs.Cfg.RendererAuthToken,
		Encoding:          string(renderType),
	}
	logger.Debug("Calling renderer plugin", "req", req)

	rc, err := rs.plugin.Client()
	if err != nil {
		return nil, err
	}
	rsp, err := rc.Render(ctx, req)
	if errors.Is(ctx.Err(), context.DeadlineExceeded) {
		logger.Error("Rendering timed out")
		return nil, ErrTimeout
	}
	if err != nil {
		return nil, err
	}
	if rsp.Error != "" {
		return nil, fmt.Errorf("rendering failed: %s", rsp.Error)
	}

	return &RenderResult{FilePath: filePath}, err
}

func (rs *RenderingService) renderCSVViaPlugin(ctx context.Context, renderKey string, opts CSVOpts) (*RenderCSVResult, error) {
	logger := rs.log.FromContext(ctx)

	// gives plugin some additional time to timeout and return possible errors.
	ctx, cancel := context.WithTimeout(ctx, getRequestTimeout(opts.TimeoutOpts))
	defer cancel()

	filePath, err := rs.getNewFilePath(RenderCSV)
	if err != nil {
		return nil, err
	}

	headers := map[string]*pluginextensionv2.StringList{}
	for k, values := range opts.Headers {
		headers[k] = &pluginextensionv2.StringList{
			Values: values,
		}
	}

	req := &pluginextensionv2.RenderCSVRequest{
		Url:       rs.getGrafanaCallbackURL(opts.Path),
		FilePath:  filePath,
		RenderKey: renderKey,
		Domain:    rs.domain,
		Timeout:   int32(opts.Timeout.Seconds()),
		Timezone:  isoTimeOffsetToPosixTz(opts.Timezone),
		Headers:   headers,
		AuthToken: rs.Cfg.RendererAuthToken,
	}
	logger.Debug("Calling renderer plugin", "req", req)

	rc, err := rs.plugin.Client()
	if err != nil {
		return nil, err
	}

	rsp, err := rc.RenderCSV(ctx, req)
	if err != nil {
		if errors.Is(ctx.Err(), context.DeadlineExceeded) {
			logger.Error("Rendering timed out")
			return nil, ErrTimeout
		}

		return nil, err
	}

	if rsp.Error != "" {
		return nil, fmt.Errorf("rendering failed: %s", rsp.Error)
	}

	return &RenderCSVResult{FilePath: filePath, FileName: rsp.FileName}, nil
}
