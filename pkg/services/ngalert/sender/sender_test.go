package sender

import (
	"fmt"
	"testing"
	"time"

	"github.com/prometheus/alertmanager/api/v2/models"
	"github.com/prometheus/client_golang/prometheus"
	common_config "github.com/prometheus/common/config"
	"github.com/prometheus/common/model"
	"github.com/prometheus/prometheus/config"
	"github.com/prometheus/prometheus/discovery"
	"github.com/prometheus/prometheus/model/labels"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
)

func TestSanitizeLabelName(t *testing.T) {
	cases := []struct {
		desc           string
		labelName      string
		expectedResult string
		expectedErr    string
	}{
		{
			desc:           "Remove whitespace",
			labelName:      "   a\tb\nc\vd\re\ff   ",
			expectedResult: "abcdef",
		},
		{
			desc:           "Replace ASCII with underscore",
			labelName:      " !\"#$%&\\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~",
			expectedResult: "________________0123456789_______ABCDEFGHIJKLMNOPQRSTUVWXYZ______abcdefghijklmnopqrstuvwxyz____",
		},
		{
			desc:           "Replace non-ASCII unicode with hex",
			labelName:      "_€_ƒ_„_†_‡_œ_Ÿ_®_º_¼_×_ð_þ_¿_±_四_十_二_🔥",
			expectedResult: "_0x20ac_0x192_0x201e_0x2020_0x2021_0x153_0x178_0xae_0xba_0xbc_0xd7_0xf0_0xfe_0xbf_0xb1_0x56db_0x5341_0x4e8c_0x1f525",
		},
		{ // labels starting with a number are invalid, so we have to make sure we don't sanitize to another invalid label.
			desc:           "If first character is replaced with hex, prefix with underscore",
			labelName:      "😍😍😍",
			expectedResult: "_0x1f60d0x1f60d0x1f60d",
		},
		{
			desc:        "Empty string should error",
			labelName:   "",
			expectedErr: "label name cannot be empty",
		},
		{
			desc:        "Only whitespace should error",
			labelName:   "   \t\n\v\n\f   ",
			expectedErr: "label name is empty after removing invalids chars",
		},
	}

	for _, tc := range cases {
		logger := log.New("ngalert.sender.external-alertmanager")
		am, err := NewExternalAlertmanagerSender(logger, prometheus.NewRegistry())
		require.NoError(t, err)
		t.Run(tc.desc, func(t *testing.T) {
			res, err := am.sanitizeLabelName(tc.labelName)

			if tc.expectedErr != "" {
				require.EqualError(t, err, tc.expectedErr)
			}

			require.Equal(t, tc.expectedResult, res)
		})
	}
}

func TestSanitizeLabelSet(t *testing.T) {
	cases := []struct {
		desc           string
		labelset       models.LabelSet
		expectedResult labels.Labels
	}{
		{
			desc: "Duplicate labels after sanitizations, append short has as suffix to duplicates",
			labelset: models.LabelSet{
				"test-alert": "42",
				"test_alert": "43",
				"test+alert": "44",
			},
			expectedResult: labels.Labels{
				labels.Label{Name: "test_alert", Value: "44"},
				labels.Label{Name: "test_alert_ed6237", Value: "42"},
				labels.Label{Name: "test_alert_a67b5e", Value: "43"},
			},
		},
		{
			desc: "If sanitize fails for a label, skip it",
			labelset: models.LabelSet{
				"test-alert":       "42",
				"   \t\n\v\n\f   ": "43",
				"test+alert":       "44",
			},
			expectedResult: labels.Labels{
				labels.Label{Name: "test_alert", Value: "44"},
				labels.Label{Name: "test_alert_ed6237", Value: "42"},
			},
		},
	}

	for _, tc := range cases {
		logger := log.New("ngalert.sender.external-alertmanager")
		am, err := NewExternalAlertmanagerSender(logger, prometheus.NewRegistry())
		require.NoError(t, err)
		t.Run(tc.desc, func(t *testing.T) {
			require.Equal(t, tc.expectedResult, am.sanitizeLabelSet(tc.labelset))
		})
	}
}

func TestWithMaxQueueCapacity(t *testing.T) {
	logger := log.NewNopLogger()

	t.Run("WithMaxQueueCapacity sets custom capacity", func(t *testing.T) {
		customCapacity := 123
		am, err := NewExternalAlertmanagerSender(logger, prometheus.NewRegistry(), WithMaxQueueCapacity(customCapacity))
		require.NoError(t, err)
		require.Equal(t, customCapacity, am.options.QueueCapacity)
	})

	t.Run("default capacity when option is not used", func(t *testing.T) {
		am, err := NewExternalAlertmanagerSender(logger, prometheus.NewRegistry())
		require.NoError(t, err)
		require.Equal(t, defaultMaxQueueCapacity, am.options.QueueCapacity)
	})

	t.Run("custom queue capacity is enforced", func(t *testing.T) {
		customCapacity := 5
		am, err := NewExternalAlertmanagerSender(logger, prometheus.NewRegistry(), WithMaxQueueCapacity(customCapacity))
		require.NoError(t, err)

		totalAlerts := customCapacity + 3
		alerts := make([]*Alert, totalAlerts)
		for i := range alerts {
			alerts[i] = &Alert{
				Labels: labels.FromStrings("alertname", fmt.Sprintf("alert_%d", i)),
			}
		}

		am.manager.Send(alerts...)

		require.Equal(t, customCapacity, len(am.manager.queue))

		for i, alert := range am.manager.queue {
			expectedLabel := fmt.Sprintf("alert_%d", i+3)
			require.Equal(t, expectedLabel, alert.Labels.Get("alertname"))
		}
	})
}

func TestWithMaxBatchSize(t *testing.T) {
	logger := log.NewNopLogger()

	t.Run("WithMaxBatchSize sets custom batch size", func(t *testing.T) {
		customBatchSize := 5
		am, err := NewExternalAlertmanagerSender(logger, prometheus.NewRegistry(), WithMaxBatchSize(customBatchSize))
		require.NoError(t, err)
		require.Equal(t, customBatchSize, am.options.MaxBatchSize)
		require.Equal(t, customBatchSize, am.manager.opts.MaxBatchSize)
	})

	t.Run("default batch size when option is not used", func(t *testing.T) {
		am, err := NewExternalAlertmanagerSender(logger, prometheus.NewRegistry())
		require.NoError(t, err)
		require.Equal(t, DefaultMaxBatchSize, am.options.MaxBatchSize)
		require.Equal(t, DefaultMaxBatchSize, am.manager.opts.MaxBatchSize)
	})

	t.Run("custom batch size is enforced", func(t *testing.T) {
		customBatchSize := 3
		am, err := NewExternalAlertmanagerSender(logger, prometheus.NewRegistry(), WithMaxBatchSize(customBatchSize))
		require.NoError(t, err)

		totalAlerts := customBatchSize * 2
		alerts := make([]*Alert, totalAlerts)
		for i := range alerts {
			alerts[i] = &Alert{
				Labels: labels.FromStrings("alertname", fmt.Sprintf("alert_%d", i)),
			}
		}

		am.manager.Send(alerts...)
		require.Equal(t, totalAlerts, len(am.manager.queue))

		firstBatch := am.manager.nextBatch()
		require.Equal(t, customBatchSize, len(firstBatch))

		secondBatch := am.manager.nextBatch()
		require.Equal(t, customBatchSize, len(secondBatch))

		emptyBatch := am.manager.nextBatch()
		require.Equal(t, 0, len(emptyBatch), "No more alerts should remain")
	})
}

func TestWithUTF8Labels(t *testing.T) {
	logger := log.NewNopLogger()

	alert := models.PostableAlert{
		Annotations: models.LabelSet{
			"some-name": "test",
		},
		Alert: models.Alert{
			Labels: models.LabelSet{
				"🔥": "fire",
			},
		},
	}

	t.Run("WithUTF8Labels preserves UTF-8 characters", func(t *testing.T) {
		am, err := NewExternalAlertmanagerSender(logger, prometheus.NewRegistry(), WithUTF8Labels())
		require.NoError(t, err)

		result := am.alertToNotifierAlert(alert)
		require.Equal(t, "test", result.Annotations.Get("some-name"))
		require.Equal(t, "fire", result.Labels.Get("🔥"))
	})

	t.Run("default sanitizes UTF-8 characters", func(t *testing.T) {
		am, err := NewExternalAlertmanagerSender(logger, prometheus.NewRegistry())
		require.NoError(t, err)

		result := am.alertToNotifierAlert(alert)
		require.Equal(t, "test", result.Annotations.Get("some_name"))
		require.Equal(t, "fire", result.Labels.Get("_0x1f525"))
	})
}

func TestExternalAMcfgToAlertmanagerConfig(t *testing.T) {
	tests := []struct {
		name        string
		cfg         ExternalAMcfg
		expected    *config.AlertmanagerConfig
		expectError bool
	}{
		{
			name: "basic configuration without TLS skip verify",
			cfg: ExternalAMcfg{
				URL:                "https://alertmanager.example.com:9093/alertmanager",
				InsecureSkipVerify: false,
			},
			expected: &config.AlertmanagerConfig{
				APIVersion: config.AlertmanagerAPIVersionV2,
				Scheme:     "https",
				PathPrefix: "/alertmanager",
				Timeout:    model.Duration(defaultTimeout),
				ServiceDiscoveryConfigs: discovery.Configs{
					discovery.StaticConfig{
						{
							Targets: []model.LabelSet{{model.AddressLabel: "alertmanager.example.com:9093"}},
						},
					},
				},
			},
			expectError: false,
		},
		{
			name: "configuration with TLS skip verify enabled",
			cfg: ExternalAMcfg{
				URL:                "https://alertmanager.example.com:9093",
				InsecureSkipVerify: true,
			},
			expected: &config.AlertmanagerConfig{
				APIVersion: config.AlertmanagerAPIVersionV2,
				Scheme:     "https",
				PathPrefix: "",
				Timeout:    model.Duration(defaultTimeout),
				ServiceDiscoveryConfigs: discovery.Configs{
					discovery.StaticConfig{
						{
							Targets: []model.LabelSet{{model.AddressLabel: "alertmanager.example.com:9093"}},
						},
					},
				},
				HTTPClientConfig: common_config.HTTPClientConfig{
					TLSConfig: common_config.TLSConfig{
						InsecureSkipVerify: true,
					},
				},
			},
			expectError: false,
		},
		{
			name: "configuration with basic auth in URL",
			cfg: ExternalAMcfg{
				URL:                "https://user:password@alertmanager.example.com:9093",
				InsecureSkipVerify: false,
			},
			expected: &config.AlertmanagerConfig{
				APIVersion: config.AlertmanagerAPIVersionV2,
				Scheme:     "https",
				PathPrefix: "",
				Timeout:    model.Duration(defaultTimeout),
				ServiceDiscoveryConfigs: discovery.Configs{
					discovery.StaticConfig{
						{
							Targets: []model.LabelSet{{model.AddressLabel: "alertmanager.example.com:9093"}},
						},
					},
				},
				HTTPClientConfig: common_config.HTTPClientConfig{
					BasicAuth: &common_config.BasicAuth{
						Username: "user",
						Password: "password",
					},
				},
			},
			expectError: false,
		},
		{
			name: "configuration with basic auth and TLS skip verify",
			cfg: ExternalAMcfg{
				URL:                "https://user:password@alertmanager.example.com:9093",
				InsecureSkipVerify: true,
			},
			expected: &config.AlertmanagerConfig{
				APIVersion: config.AlertmanagerAPIVersionV2,
				Scheme:     "https",
				PathPrefix: "",
				Timeout:    model.Duration(defaultTimeout),
				ServiceDiscoveryConfigs: discovery.Configs{
					discovery.StaticConfig{
						{
							Targets: []model.LabelSet{{model.AddressLabel: "alertmanager.example.com:9093"}},
						},
					},
				},
				HTTPClientConfig: common_config.HTTPClientConfig{
					BasicAuth: &common_config.BasicAuth{
						Username: "user",
						Password: "password",
					},
					TLSConfig: common_config.TLSConfig{
						InsecureSkipVerify: true,
					},
				},
			},
			expectError: false,
		},
		{
			name: "configuration with custom timeout",
			cfg: ExternalAMcfg{
				URL:                "https://alertmanager.example.com:9093",
				Timeout:            30 * time.Second,
				InsecureSkipVerify: false,
			},
			expected: &config.AlertmanagerConfig{
				APIVersion: config.AlertmanagerAPIVersionV2,
				Scheme:     "https",
				PathPrefix: "",
				Timeout:    model.Duration(30 * time.Second),
				ServiceDiscoveryConfigs: discovery.Configs{
					discovery.StaticConfig{
						{
							Targets: []model.LabelSet{{model.AddressLabel: "alertmanager.example.com:9093"}},
						},
					},
				},
			},
			expectError: false,
		},
		{
			name: "invalid URL should return error",
			cfg: ExternalAMcfg{
				URL:                "://invalid-url",
				InsecureSkipVerify: false,
			},
			expected:    nil,
			expectError: true,
		},
		{
			name: "configuration with TLS client auth",
			cfg: ExternalAMcfg{
				URL:           "https://alertmanager.example.com:9093",
				TLSClientCert: "client-cert-content",
				TLSClientKey:  "client-key-content",
			},
			expected: &config.AlertmanagerConfig{
				APIVersion: config.AlertmanagerAPIVersionV2,
				Scheme:     "https",
				PathPrefix: "",
				Timeout:    model.Duration(defaultTimeout),
				ServiceDiscoveryConfigs: discovery.Configs{
					discovery.StaticConfig{
						{
							Targets: []model.LabelSet{{model.AddressLabel: "alertmanager.example.com:9093"}},
						},
					},
				},
				HTTPClientConfig: common_config.HTTPClientConfig{
					TLSConfig: common_config.TLSConfig{
						Cert: "client-cert-content",
						Key:  "client-key-content",
					},
				},
			},
			expectError: false,
		},
		{
			name: "configuration with TLS client auth and skip verify",
			cfg: ExternalAMcfg{
				URL:                "https://alertmanager.example.com:9093",
				InsecureSkipVerify: true,
				TLSClientCert:      "client-cert-content",
				TLSClientKey:       "client-key-content",
			},
			expected: &config.AlertmanagerConfig{
				APIVersion: config.AlertmanagerAPIVersionV2,
				Scheme:     "https",
				PathPrefix: "",
				Timeout:    model.Duration(defaultTimeout),
				ServiceDiscoveryConfigs: discovery.Configs{
					discovery.StaticConfig{
						{
							Targets: []model.LabelSet{{model.AddressLabel: "alertmanager.example.com:9093"}},
						},
					},
				},
				HTTPClientConfig: common_config.HTTPClientConfig{
					TLSConfig: common_config.TLSConfig{
						InsecureSkipVerify: true,
						Cert:               "client-cert-content",
						Key:                "client-key-content",
					},
				},
			},
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			amConfig, err := externalAMcfgToAlertmanagerConfig(tt.cfg)

			if tt.expectError {
				require.Error(t, err)
				return
			}

			require.NoError(t, err)
			require.Equal(t, tt.expected, amConfig)
		})
	}
}
