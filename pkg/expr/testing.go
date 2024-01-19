package expr

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginclient"
)

type recordingCallResourceHandler struct {
	pluginclient.Client
	recordings    []*pluginclient.CallResourceRequest
	response      *backend.CallResourceResponse
	pluginContext backend.PluginContext
	errorResult   error
}

func (f *recordingCallResourceHandler) CallResource(ctx context.Context, req *pluginclient.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	f.recordings = append(f.recordings, req)

	if f.errorResult != nil {
		return f.errorResult
	}

	if req.Validate != nil {
		if err := req.Validate(ctx, f.pluginContext); err != nil {
			return err
		}
	}

	return sender.Send(f.response)
}
