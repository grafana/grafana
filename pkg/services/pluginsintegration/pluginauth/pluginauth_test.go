package pluginauth

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/setting"
)

func TestLocalAPIURL(t *testing.T) {
	for _, tc := range []struct {
		name string
		cfg  setting.Cfg
		want string
	}{
		{name: "all interfaces", cfg: setting.Cfg{Protocol: setting.HTTPScheme, HTTPAddr: "0.0.0.0", HTTPPort: "3000"}, want: "http://127.0.0.1:3000"},
		{name: "unset address", cfg: setting.Cfg{Protocol: setting.HTTPScheme, HTTPPort: "3000"}, want: "http://127.0.0.1:3000"},
		{name: "all IPv6 interfaces", cfg: setting.Cfg{Protocol: setting.HTTPScheme, HTTPAddr: "::", HTTPPort: "3000"}, want: "http://127.0.0.1:3000"},
		{name: "loopback", cfg: setting.Cfg{Protocol: setting.HTTPScheme, HTTPAddr: "127.0.0.1", HTTPPort: "3001"}, want: "http://127.0.0.1:3001"},
		{name: "IPv6 loopback", cfg: setting.Cfg{Protocol: setting.HTTPScheme, HTTPAddr: "::1", HTTPPort: "3000"}, want: "http://[::1]:3000"},
		{name: "localhost", cfg: setting.Cfg{Protocol: setting.HTTPScheme, HTTPAddr: "localhost", HTTPPort: "3000"}, want: "http://localhost:3000"},
		{name: "served from a sub path", cfg: setting.Cfg{Protocol: setting.HTTPScheme, HTTPPort: "3000", AppSubURL: "/grafana", ServeFromSubPath: true}, want: "http://127.0.0.1:3000/grafana"},
		{name: "sub path stripped by a proxy", cfg: setting.Cfg{Protocol: setting.HTTPScheme, HTTPPort: "3000", AppSubURL: "/grafana"}, want: "http://127.0.0.1:3000"},
		{name: "another address", cfg: setting.Cfg{Protocol: setting.HTTPScheme, HTTPAddr: "10.0.0.5", HTTPPort: "3000"}},
		{name: "HTTPS", cfg: setting.Cfg{Protocol: setting.HTTPSScheme, HTTPPort: "3000"}},
		{name: "HTTP/2", cfg: setting.Cfg{Protocol: setting.HTTP2Scheme, HTTPPort: "3000"}},
		{name: "socket", cfg: setting.Cfg{Protocol: setting.SocketScheme}},
		{name: "random port", cfg: setting.Cfg{Protocol: setting.HTTPScheme, HTTPPort: "0"}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, tc.want, LocalAPIURL(&tc.cfg))
		})
	}
	require.Empty(t, LocalAPIURL(nil))
}
