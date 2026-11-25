package liveserver

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func Test_redisClientOptions(t *testing.T) {
	testCases := []struct {
		name         string
		address      string
		password     string
		wantErr      bool
		wantAddr     string
		wantUsername string
		wantPassword string
		wantDB       int
		wantTLS      bool
	}{
		{name: "plain host:port address", address: "127.0.0.1:6379", password: "config-password", wantAddr: "127.0.0.1:6379", wantPassword: "config-password"},
		{name: "redis URL without credentials gets the config password", address: "redis://example.com:6379", password: "config-password", wantAddr: "example.com:6379", wantPassword: "config-password"},
		{name: "rediss URL enables TLS", address: "rediss://example.com:6380", wantAddr: "example.com:6380", wantTLS: true},
		{name: "URL credentials take precedence over the config password", address: "redis://user:url-password@example.com:6379", password: "config-password", wantAddr: "example.com:6379", wantUsername: "user", wantPassword: "url-password"},
		{name: "explicitly empty URL password takes precedence too", address: "redis://user:@example.com:6379", password: "config-password", wantAddr: "example.com:6379", wantUsername: "user", wantPassword: ""},
		{name: "URL with username but no password gets the config password", address: "rediss://user@example.com:6380", password: "config-password", wantAddr: "example.com:6380", wantUsername: "user", wantPassword: "config-password", wantTLS: true},
		{name: "database number from the URL path", address: "redis://example.com:6379/4", wantAddr: "example.com:6379", wantDB: 4},
		{name: "invalid database number in the URL path", address: "redis://example.com:6379/not-a-number", wantErr: true},
		{name: "unparsable URL does not leak credentials in the error", address: "rediss://user:secret@exa mple.com:6379", wantErr: true},
		{name: "unsupported scheme is used as a plain address", address: "unix:///tmp/redis.sock", password: "config-password", wantAddr: "unix:///tmp/redis.sock", wantPassword: "config-password"},
		{name: "skip_verify is rejected without leaking credentials", address: "rediss://user:secret-pw@example.com:6380?skip_verify=true", wantErr: true},
		{name: "unescaped password whose inner parse error would quote it", address: "rediss://user:secret/pw@example.com:6380", wantErr: true},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			options, err := RedisClientOptions(RedisOptions{Address: tc.address, Password: tc.password})
			if tc.wantErr {
				require.Error(t, err)
				require.NotContains(t, err.Error(), "secret")
				return
			}
			require.NoError(t, err)
			require.Equal(t, tc.wantAddr, options.Addr)
			require.Equal(t, tc.wantUsername, options.Username)
			require.Equal(t, tc.wantPassword, options.Password)
			require.Equal(t, tc.wantDB, options.DB)
			if tc.wantTLS {
				require.NotNil(t, options.TLSConfig)
				require.Equal(t, "example.com", options.TLSConfig.ServerName)
			} else {
				require.Nil(t, options.TLSConfig)
			}
		})
	}
}
