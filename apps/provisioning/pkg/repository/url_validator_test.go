package repository

import (
	"context"
	"errors"
	"net"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestURLValidator_ValidateURL(t *testing.T) {
	tests := []struct {
		name             string
		rawURL           string
		allowlistEntries []string
		resolver         ipAddressResolver
		wantErrContains  string
	}{
		{
			name:            "blocks literal private IP",
			rawURL:          "https://10.0.0.10/grafana/grafana.git",
			wantErrContains: `URL host "10.0.0.10" resolves to blocked IP 10.0.0.10`,
		},
		{
			name:   "blocks DNS resolving to private IP",
			rawURL: "https://internal.example.com/grafana/grafana.git",
			resolver: func(_ context.Context, host string) ([]net.IPAddr, error) {
				require.Equal(t, "internal.example.com", host)
				return []net.IPAddr{{IP: net.ParseIP("10.0.0.10")}}, nil
			},
			wantErrContains: `URL host "internal.example.com" resolves to blocked IP 10.0.0.10`,
		},
		{
			name:   "allows public DNS",
			rawURL: "https://example.com/grafana/grafana.git",
			resolver: func(_ context.Context, host string) ([]net.IPAddr, error) {
				require.Equal(t, "example.com", host)
				return []net.IPAddr{{IP: net.ParseIP("93.184.216.34")}}, nil
			},
		},
		{
			name:             "allows exact IP",
			rawURL:           "https://10.0.0.10/grafana/grafana.git",
			allowlistEntries: []string{"10.0.0.10"},
		},
		{
			name:             "allows CIDR match",
			rawURL:           "https://10.0.0.10/grafana/grafana.git",
			allowlistEntries: []string{"10.0.0.0/24"},
		},
		{
			name:             "allows hostname without resolving",
			rawURL:           "https://internal.example.com/grafana/grafana.git",
			allowlistEntries: []string{"internal.example.com"},
			resolver: func(context.Context, string) ([]net.IPAddr, error) {
				t.Fatal("resolver should not be called for an allowlisted host")
				return nil, nil
			},
		},
		{
			name:   "returns resolver errors",
			rawURL: "https://internal.example.com/grafana/grafana.git",
			resolver: func(context.Context, string) ([]net.IPAddr, error) {
				return nil, errors.New("resolver failed")
			},
			wantErrContains: `resolve URL host "internal.example.com": resolver failed`,
		},
		{
			name:   "rejects empty resolver results",
			rawURL: "https://internal.example.com/grafana/grafana.git",
			resolver: func(context.Context, string) ([]net.IPAddr, error) {
				return nil, nil
			},
			wantErrContains: `URL host "internal.example.com" did not resolve to any IP addresses`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			allowlist, err := NewAllowlist(tt.allowlistEntries)
			require.NoError(t, err)

			resolver := tt.resolver
			if resolver == nil {
				resolver = func(context.Context, string) ([]net.IPAddr, error) {
					return []net.IPAddr{{IP: net.ParseIP("93.184.216.34")}}, nil
				}
			}
			validator := NewURLValidator(allowlist, resolver)

			err = validator.ValidateURL(context.Background(), tt.rawURL)
			if tt.wantErrContains != "" {
				require.Error(t, err)
				require.Contains(t, err.Error(), tt.wantErrContains)
				return
			}
			require.NoError(t, err)
		})
	}
}

func TestURLValidator_ValidateURL_InvalidURL(t *testing.T) {
	allowlist, err := NewAllowlist(nil)
	require.NoError(t, err)

	validator := NewURLValidator(allowlist, func(context.Context, string) ([]net.IPAddr, error) {
		t.Fatal("resolver should not be called for an invalid URL")
		return nil, nil
	})

	err = validator.ValidateURL(context.Background(), "https://")
	require.Error(t, err)
	require.Contains(t, err.Error(), `private endpoint allowlist entry "https://" has an empty host`)
}
