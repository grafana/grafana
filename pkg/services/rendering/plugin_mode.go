package rendering

import (
	"context"
	"errors"
	"fmt"
	"time"

	pluginModel "github.com/grafana/grafana-plugin-model/go/renderer"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/pluginextensionv2"
)

func (rs *RenderingService) startPlugin(ctx context.Context) error {
	return rs.pluginInfo.Start(ctx)
}

func (rs *RenderingService) renderViaPlugin(ctx context.Context, renderKey string, opts Opts) (*RenderResult, error) {
	// gives plugin some additional time to timeout and return possible errors.
	ctx, cancel := context.WithTimeout(ctx, opts.Timeout+time.Second*2)
	defer cancel()

	if rs.pluginInfo.GrpcPluginV2 != nil {
		return rs.renderViaPluginV2(ctx, renderKey, opts)
	}

	return rs.renderViaPluginV1(ctx, renderKey, opts)
}

func (rs *RenderingService) renderViaPluginV1(ctx context.Context, renderKey string, opts Opts) (*RenderResult, error) {
	filePath, err := rs.getNewFilePath(RenderPNG)
	if err != nil {
		return nil, err
	}

	req := &pluginModel.RenderRequest{
		Url:       rs.getURL(opts.Path),
		Width:     int32(opts.Width),
		Height:    int32(opts.Height),
		FilePath:  filePath,
		Timeout:   int32(opts.Timeout.Seconds()),
		RenderKey: renderKey,
		Encoding:  opts.Encoding,
		Timezone:  isoTimeOffsetToPosixTz(opts.Timezone),
		Domain:    rs.domain,
	}
	rs.log.Debug("calling renderer plugin", "req", req)

	rsp, err := rs.pluginInfo.GrpcPluginV1.Render(ctx, req)
	if errors.Is(ctx.Err(), context.DeadlineExceeded) {
		rs.log.Info("Rendering timed out")
		return nil, ErrTimeout
	}
	if err != nil {
		return nil, err
	}
	if rsp.Error != "" {
		return nil, fmt.Errorf("rendering failed: %v", rsp.Error)
	}

	return &RenderResult{FilePath: filePath}, nil
}

func (rs *RenderingService) renderViaPluginV2(ctx context.Context, renderKey string, opts Opts) (*RenderResult, error) {
	filePath, err := rs.getNewFilePath(RenderPNG)
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
		Url:               rs.getURL(opts.Path),
		Width:             int32(opts.Width),
		Height:            int32(opts.Height),
		DeviceScaleFactor: float32(opts.DeviceScaleFactor),
		FilePath:          filePath,
		Timeout:           int32(opts.Timeout.Seconds()),
		RenderKey:         renderKey,
		Timezone:          isoTimeOffsetToPosixTz(opts.Timezone),
		Domain:            rs.domain,
		Headers:           headers,
	}
	rs.log.Debug("Calling renderer plugin", "req", req)

	rsp, err := rs.pluginInfo.GrpcPluginV2.Render(ctx, req)
	if errors.Is(ctx.Err(), context.DeadlineExceeded) {
		rs.log.Info("Rendering timed out")
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
	// gives plugin some additional time to timeout and return possible errors.
	ctx, cancel := context.WithTimeout(ctx, opts.Timeout+time.Second*2)
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
		Url:       rs.getURL(opts.Path),
		FilePath:  filePath,
		RenderKey: renderKey,
		Domain:    rs.domain,
		Timeout:   int32(opts.Timeout.Seconds()),
		Timezone:  isoTimeOffsetToPosixTz(opts.Timezone),
		Headers:   headers,
	}
	rs.log.Debug("Calling renderer plugin", "req", req)

	rsp, err := rs.pluginInfo.GrpcPluginV2.RenderCSV(ctx, req)
	if err != nil {
		if errors.Is(ctx.Err(), context.DeadlineExceeded) {
			rs.log.Info("Rendering timed out")
			return nil, ErrTimeout
		}

		return nil, err
	}

	if rsp.Error != "" {
		return nil, fmt.Errorf("rendering failed: %s", rsp.Error)
	}

	return &RenderCSVResult{FilePath: filePath, FileName: rsp.FileName}, nil
}
