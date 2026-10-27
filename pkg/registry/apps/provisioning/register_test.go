package provisioning

import (
	"context"
	"net/url"
	"testing"

	"github.com/stretchr/testify/require"

	sdkapp "github.com/grafana/grafana-app-sdk/app"
)

func TestHTTPRequestKeepsThePeerAddress(t *testing.T) {
	req := &sdkapp.CustomRouteRequest{Method: "POST", URL: &url.URL{Path: "/webhook"}}

	withAddr := httpRequest(context.WithValue(context.Background(), remoteAddrKey{}, "203.0.113.7:4242"), req)
	require.Equal(t, "203.0.113.7:4242", withAddr.RemoteAddr)

	other := httpRequest(context.WithValue(context.Background(), remoteAddrKey{}, "198.51.100.9:1000"), req)
	require.NotEqual(t, withAddr.RemoteAddr, other.RemoteAddr, "distinct senders must stay distinguishable for rate limiting")

	require.Empty(t, httpRequest(context.Background(), req).RemoteAddr)
}
