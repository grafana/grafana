package v3

import (
	"context"

	pluginv3 "github.com/grafana/grafana-app-sdk/plugin/genproto/grafana/plugin/v3"
)

// ClientV3 provides the services negotiated through plugin protocol v3.
type ClientV3 interface {
	pluginv3.AdmissionServiceClient
	pluginv3.ConversionServiceClient
	pluginv3.RouteServiceClient
}

// ClientV3Loader returns a plugin's v3 client once the registry has loaded it.
type ClientV3Loader interface {
	ClientV3(ctx context.Context, pluginID string) (ClientV3, bool)
}
