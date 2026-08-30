package v1

import (
	"testing"

	"github.com/prometheus/alertmanager/config"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestExtraConfiguration_GetAlertmanagerConfig(t *testing.T) {
	t.Run("error when config is empty", func(t *testing.T) {
		c := ExtraConfiguration{Identifier: "test"}
		_, err := c.GetAlertmanagerConfig()
		require.Error(t, err)
	})

	t.Run("error when config is invalid YAML", func(t *testing.T) {
		c := ExtraConfiguration{Identifier: "test", AlertmanagerConfig: "not: valid: yaml: ["}
		_, err := c.GetAlertmanagerConfig()
		require.Error(t, err)
	})

	t.Run("converts all fields from Prometheus/Mimir config", func(t *testing.T) {
		const yaml = `
route:
  receiver: recv1
receivers:
  - name: recv1
  - name: recv2
inhibit_rules:
  - source_matchers:
      - severity = critical
    target_matchers:
      - severity = warning
    equal:
      - cluster
time_intervals:
  - name: business-hours
    time_intervals:
      - weekdays: [monday:friday]
mute_time_intervals:
  - name: weekends
    time_intervals:
      - weekdays: [saturday, sunday]
`
		c := ExtraConfiguration{Identifier: "test", AlertmanagerConfig: yaml}
		cfg, err := c.GetAlertmanagerConfig()
		require.NoError(t, err)

		require.NotNil(t, cfg.Route)
		assert.Equal(t, "recv1", cfg.Route.Receiver)

		require.Len(t, cfg.Receivers, 2)
		assert.Equal(t, "recv1", cfg.Receivers[0].Name)
		assert.Equal(t, "recv2", cfg.Receivers[1].Name)

		require.Len(t, cfg.InhibitRules, 1)

		require.Len(t, cfg.TimeIntervals, 1)
		assert.Equal(t, "business-hours", cfg.TimeIntervals[0].Name)

		require.Len(t, cfg.MuteTimeIntervals, 1)
		assert.Equal(t, "weekends", cfg.MuteTimeIntervals[0].Name)
	})

	t.Run("preserves upstream receivers and converts to Grafana format on demand", func(t *testing.T) {
		const yaml = `
route:
  receiver: recv1
receivers:
  - name: recv1
    webhook_configs:
      - url: "http://localhost/"
`
		c := ExtraConfiguration{Identifier: "test", AlertmanagerConfig: yaml}
		cfg, err := c.GetAlertmanagerConfig()
		require.NoError(t, err)

		require.Len(t, cfg.Receivers, 1)
		recv := cfg.Receivers[0]
		assert.Equal(t, "recv1", recv.Name)
		require.Len(t, recv.WebhookConfigs, 1)
	})
}

func TestExtraAlertmanagerConfig_ToGrafanaReceivers(t *testing.T) {
	t.Run("empty receivers", func(t *testing.T) {
		c := ExtraAlertmanagerConfig{}
		got, err := c.ToGrafanaReceivers()
		require.NoError(t, err)
		assert.Empty(t, got)
	})

	t.Run("receiver without integrations passes through", func(t *testing.T) {
		c := ExtraAlertmanagerConfig{Receivers: []config.Receiver{{Name: "recv1"}}}
		got, err := c.ToGrafanaReceivers()
		require.NoError(t, err)
		require.Len(t, got, 1)
		assert.Equal(t, "recv1", got[0].Name)
		assert.Empty(t, got[0].GrafanaManagedReceivers)
	})

	t.Run("Mimir integrations are converted to Grafana receivers", func(t *testing.T) {
		const yaml = `
route:
  receiver: recv1
receivers:
  - name: recv1
    webhook_configs:
      - url: "http://localhost/"
`
		c := ExtraConfiguration{Identifier: "test", AlertmanagerConfig: yaml}
		cfg, err := c.GetAlertmanagerConfig()
		require.NoError(t, err)

		got, err := cfg.ToGrafanaReceivers()
		require.NoError(t, err)
		require.Len(t, got, 1)
		assert.Equal(t, "recv1", got[0].Name)
		require.Len(t, got[0].GrafanaManagedReceivers, 1)
		assert.Equal(t, "webhook", got[0].GrafanaManagedReceivers[0].Type)
	})
}

func TestExtraAlertmanagerConfig_ToGrafanaRoute(t *testing.T) {
	c := ExtraAlertmanagerConfig{
		Route: &config.Route{
			Receiver:          "root",
			MuteTimeIntervals: []string{"weekends"},
			Routes: []*config.Route{
				{Receiver: "child"},
			},
		},
	}

	route := c.ToGrafanaRoute()
	require.NotNil(t, route)
	assert.Equal(t, "root", route.Receiver)
	assert.Equal(t, []string{"weekends"}, route.MuteTimeIntervals)
	require.Len(t, route.Routes, 1)
	assert.Equal(t, "child", route.Routes[0].Receiver)
}

func TestExtraAlertmanagerConfig_ToGrafanaTimeIntervals(t *testing.T) {
	c := ExtraAlertmanagerConfig{
		MuteTimeIntervals: []config.MuteTimeInterval{{Name: "weekends"}},
		TimeIntervals:     []config.TimeInterval{{Name: "business-hours"}},
	}

	times := c.ToGrafanaTimeIntervals()
	require.Len(t, times, 2)
	assert.Equal(t, "weekends", times[0].Title)
	assert.Equal(t, "business-hours", times[1].Title)
}

func TestExtraAlertmanagerConfig_ReceiverNameStubs(t *testing.T) {
	c := ExtraAlertmanagerConfig{
		Receivers: []config.Receiver{
			{Name: "recv1", WebhookConfigs: []*config.WebhookConfig{{}}},
			{Name: "recv2"},
		},
	}

	stubs := c.ReceiverNameStubs()
	require.Len(t, stubs, 2)
	assert.Equal(t, "recv1", stubs[0].Name)
	assert.Equal(t, "recv2", stubs[1].Name)
	// Only names are carried over; receiver contents are dropped.
	assert.Empty(t, stubs[0].GrafanaManagedReceivers)
}

func TestExtraConfiguration_Validate(t *testing.T) {
	testCases := []struct {
		name          string
		config        ExtraConfiguration
		expectedError string
	}{
		{
			name: "valid configuration",
			config: ExtraConfiguration{
				Identifier: "test-config",
				AlertmanagerConfig: `route:
  receiver: default
receivers:
  - name: default`,
			},
		},
		{
			name: "empty identifier",
			config: ExtraConfiguration{
				Identifier:         "",
				AlertmanagerConfig: `route: {receiver: default}`,
			},
			expectedError: "identifier is required",
		},
		{
			name: "invalid YAML alertmanager config",
			config: ExtraConfiguration{
				Identifier:         "test-config",
				AlertmanagerConfig: `invalid: yaml: content: [`,
			},
			expectedError: "failed to parse alertmanager config",
		},
		{
			name: "missing route in alertmanager config",
			config: ExtraConfiguration{
				Identifier: "test-config",
				AlertmanagerConfig: `receivers:
  - name: default`,
			},
			expectedError: "no routes provided",
		},
		{
			name: "missing receivers in alertmanager config",
			config: ExtraConfiguration{
				Identifier: "test-config",
				AlertmanagerConfig: `route:
  receiver: default`,
			},
			expectedError: "undefined receiver",
		},
		{
			name: "empty alertmanager config",
			config: ExtraConfiguration{
				Identifier:         "test-config",
				AlertmanagerConfig: "",
			},
			expectedError: "failed to parse alertmanager config",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			err := tc.config.Validate()
			if tc.expectedError == "" {
				require.NoError(t, err)
			} else {
				require.ErrorContains(t, err, tc.expectedError)
			}
		})
	}
}
