package repository

import (
	"net"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestNewAllowlist(t *testing.T) {
	tests := []struct {
		name          string
		entries       []string
		allowedHosts  []string
		blockedHosts  []string
		allowedIPs    []string
		blockedIPs    []string
		wantErr       bool
		wantErrString string
	}{
		{
			name:         "allows hostnames case insensitively",
			entries:      []string{" Internal.Example.Com. "},
			allowedHosts: []string{"internal.example.com", "INTERNAL.EXAMPLE.COM."},
			blockedHosts: []string{"other.example.com"},
		},
		{
			name:         "allows host from host and port",
			entries:      []string{"internal.example.com:8443"},
			allowedHosts: []string{"internal.example.com"},
			blockedHosts: []string{"other.example.com"},
		},
		{
			name:         "allows host from URL",
			entries:      []string{"https://internal.example.com/grafana/grafana.git"},
			allowedHosts: []string{"internal.example.com"},
			blockedHosts: []string{"other.example.com"},
		},
		{
			name:       "allows exact IP",
			entries:    []string{"10.0.0.10"},
			allowedIPs: []string{"10.0.0.10"},
			blockedIPs: []string{"10.0.0.11"},
		},
		{
			name:       "allows bracketed IP",
			entries:    []string{"[::1]"},
			allowedIPs: []string{"::1"},
			blockedIPs: []string{"::2"},
		},
		{
			name:       "allows IP from host and port",
			entries:    []string{"10.0.0.10:8443"},
			allowedIPs: []string{"10.0.0.10"},
			blockedIPs: []string{"10.0.0.11"},
		},
		{
			name:       "allows CIDR match",
			entries:    []string{"10.0.0.0/24"},
			allowedIPs: []string{"10.0.0.10"},
			blockedIPs: []string{"10.0.1.10"},
		},
		{
			name:         "ignores empty entries",
			entries:      []string{"", " ", "internal.example.com"},
			allowedHosts: []string{"internal.example.com"},
		},
		{
			name:          "rejects URL with empty host",
			entries:       []string{"https://"},
			wantErr:       true,
			wantErrString: `private endpoint allowlist entry "https://" has an empty host`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			allowlist, err := NewAllowlist(tt.entries)
			if tt.wantErr {
				require.Error(t, err)
				require.Contains(t, err.Error(), tt.wantErrString)
				return
			}
			require.NoError(t, err)

			for _, host := range tt.allowedHosts {
				require.True(t, allowlist.AllowsHost(host), "expected host %q to be allowed", host)
			}
			for _, host := range tt.blockedHosts {
				require.False(t, allowlist.AllowsHost(host), "expected host %q to be blocked", host)
			}
			for _, ip := range tt.allowedIPs {
				require.True(t, allowlist.AllowsIP(net.ParseIP(ip)), "expected IP %q to be allowed", ip)
			}
			for _, ip := range tt.blockedIPs {
				require.False(t, allowlist.AllowsIP(net.ParseIP(ip)), "expected IP %q to be blocked", ip)
			}
		})
	}
}
