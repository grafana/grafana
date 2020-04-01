package rendering

import (
	"context"
	"fmt"
	"time"

	pluginModel "github.com/grafana/grafana-plugin-model/go/renderer"
)

func (rs *RenderingService) startPlugin(ctx context.Context) error {
	return rs.pluginInfo.Start(ctx)
}

func (rs *RenderingService) renderViaPlugin(ctx context.Context, renderKey string, opts Opts) (*RenderResult, error) {
	pngPath, err := rs.getFilePathForNewImage()
	if err != nil {
		return nil, err
	}

	// gives plugin some additional time to timeout and return possible errors.
	ctx, cancel := context.WithTimeout(ctx, opts.Timeout+time.Second*2)
	defer cancel()

	req := &pluginModel.RenderRequest{
		Url:       rs.getURL(opts.Path),
		Width:     int32(opts.Width),
		Height:    int32(opts.Height),
		FilePath:  pngPath,
		Timeout:   int32(opts.Timeout.Seconds()),
		RenderKey: renderKey,
		Encoding:  opts.Encoding,
		Timezone:  isoTimeOffsetToPosixTz(opts.Timezone),
		Domain:    rs.domain,
	}
	rs.log.Debug("calling renderer plugin", "req", req)

	rsp, err := rs.pluginInfo.GrpcPlugin.Render(ctx, req)
	if err != nil {
		return nil, err
	}
	if rsp.Error != "" {
		return nil, fmt.Errorf("Rendering failed: %v", rsp.Error)
	}

	return &RenderResult{FilePath: pngPath}, err
}
