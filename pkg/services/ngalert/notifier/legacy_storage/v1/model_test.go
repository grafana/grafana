package v1

import (
	"testing"

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

	t.Run("converts receivers to Grafana format", func(t *testing.T) {
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
		require.Len(t, recv.GrafanaManagedReceivers, 1)
		assert.Equal(t, "webhook", recv.GrafanaManagedReceivers[0].Type)
	})
}
