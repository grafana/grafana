package config

import (
	"net/url"
	"testing"
	"time"

	"github.com/grafana/alerting/notify/historian/lokiclient"
	"github.com/spf13/pflag"
	"github.com/stretchr/testify/require"
)

func TestRuntimeConfig(t *testing.T) {
	lokiURL := mustParseURL("http://localhost:3100")

	tests := []struct {
		name     string
		args     []string
		expected RuntimeConfig
	}{
		{
			name: "default config",
			args: []string{},
			expected: RuntimeConfig{
				Notification: NotificationConfig{
					Enabled: false,
					Loki: LokiConfig{
						LokiConfig: lokiclient.LokiConfig{
							ReadPathURL:    nil,
							MaxQueryLength: 721 * time.Hour,
							MaxQuerySize:   65536,
						},
					},
				},
			},
		},
		{
			name: "with notification enabled",
			args: []string{"--alerting.historian.notification.enabled"},
			expected: RuntimeConfig{
				Notification: NotificationConfig{
					Enabled: true,
					Loki: LokiConfig{
						LokiConfig: lokiclient.LokiConfig{
							ReadPathURL:    nil,
							MaxQueryLength: 721 * time.Hour,
							MaxQuerySize:   65536,
						},
					},
				},
			},
		},
		{
			name: "with loki options",
			args: []string{
				"--alerting.historian.notification.loki.read-url=http://localhost:3100",
				"--alerting.historian.notification.loki.user=foo",
				"--alerting.historian.notification.loki.password=bar",
				"--alerting.historian.notification.loki.tenant-id=baz",
			},
			expected: RuntimeConfig{
				Notification: NotificationConfig{
					Enabled: false,
					Loki: LokiConfig{
						LokiConfig: lokiclient.LokiConfig{
							ReadPathURL:       lokiURL,
							BasicAuthUser:     "foo",
							BasicAuthPassword: "bar",
							TenantID:          "baz",
							MaxQueryLength:    721 * time.Hour,
							MaxQuerySize:      65536,
						},
					},
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := &RuntimeConfig{}
			flags := pflag.NewFlagSet("test", pflag.ContinueOnError)

			cfg.AddFlags(flags)

			err := flags.Parse(tt.args)
			require.NoError(t, err)
			require.Equal(t, tt.expected, *cfg)
		})
	}
}

func mustParseURL(s string) *url.URL {
	u, err := url.Parse(s)
	if err != nil {
		panic(err)
	}
	return u
}
