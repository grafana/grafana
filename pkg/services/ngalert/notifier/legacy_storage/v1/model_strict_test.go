package v1

import (
	"reflect"
	"strings"
	"testing"

	"github.com/grafana/alerting/definition/compat"
	"github.com/grafana/alerting/http/v0mimir/v0mimirtest"
	"github.com/grafana/alerting/notify/notifytest"
	"github.com/prometheus/alertmanager/config"
	commoncfg "github.com/prometheus/common/config"
	"github.com/stretchr/testify/require"
	"go.yaml.in/yaml/v3"
)

func TestValidateStrict_UnknownFields(t *testing.T) {
	tests := []struct {
		name   string
		yaml   string
		fields []string
	}{
		{"minimal", "route: {receiver: a}\nreceivers: [{name: a}]", nil},
		{"email typo", "route: {receiver: a}\nreceivers:\n  - name: a\n    email_configs:\n      - to: a@example.com\n        typo_field: x", []string{"typo_field"}},
		{"unknown integration", "route: {receiver: a}\nreceivers:\n  - name: a\n    foo_configs: [{}]", []string{"foo_configs"}},
		{"unknown global", "route: {receiver: a}\nreceivers: [{name: a}]\nglobal:\n  unknown_global: x", []string{"unknown_global"}},
		{"multiple", "route:\n  receiver: a\n  labels: {a: b}\nglobal:\n  unknown_global: x\nreceivers:\n  - name: a\n    email_configs:\n      - to: a@example.com\n        typo_field: x\n    foo_configs: [{}]", []string{"labels", "unknown_global", "typo_field", "foo_configs"}},
		{"mattermost", "route: {receiver: a}\nreceivers:\n  - name: a\n    mattermost_configs: [{}]", []string{"mattermost_configs"}},
		{"rocketchat", "route: {receiver: a}\nreceivers:\n  - name: a\n    rocketchat_configs: [{}]", []string{"rocketchat_configs"}},
		{"incidentio", "route: {receiver: a}\nreceivers:\n  - name: a\n    incidentio_configs: [{}]", []string{"incidentio_configs"}},
		{"discord avatar", "route: {receiver: a}\nreceivers:\n  - name: a\n    discord_configs:\n      - webhook_url: https://example.com\n        avatar_url: https://example.com", []string{"avatar_url"}},
		{"webhook payload", "route: {receiver: a}\nreceivers:\n  - name: a\n    webhook_configs:\n      - url: https://example.com\n        payload: template", []string{"payload"}},
		{"slack app token", "route: {receiver: a}\nreceivers:\n  - name: a\n    slack_configs:\n      - channel: '#alerts'\n        app_token: secret", []string{"app_token"}},
		{"route labels", "route: {receiver: a, labels: {a: b}}\nreceivers: [{name: a}]", []string{"labels"}},
		{"nested HTTP config", "route: {receiver: a}\nreceivers:\n  - name: a\n    webhook_configs:\n      - url: https://example.com\n        http_config:\n          typo_field: x", []string{"typo_field"}},
		{"slack timeout", "route: {receiver: a}\nreceivers: [{name: a, slack_configs: [{api_url: 'https://example.com', timeout: 1s}]}]", []string{"timeout"}},
		{"alias", "route: {receiver: a}\nreceivers:\n- name: a\n  webhook_configs:\n  - &hook {url: 'https://example.com', typo: hidden}\n- name: b\n  webhook_configs: [*hook]", []string{"typo"}},
		{"merge", "route: {receiver: a}\nreceivers:\n- name: a\n  webhook_configs:\n  - &hook {url: 'https://example.com', typo: hidden}\n- name: b\n  webhook_configs:\n  - <<: *hook", []string{"typo"}},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			cfg := ExtraConfiguration{Identifier: "test", AlertmanagerConfig: tc.yaml}
			err := cfg.ValidateStrict()
			if len(tc.fields) == 0 {
				require.NoError(t, err)
				return
			}
			require.Error(t, err)
			for _, field := range tc.fields {
				require.Contains(t, err.Error(), field)
			}
			require.NotContains(t, err.Error(), "secret")
		})
	}
}

func TestValidateStrict_AllSupportedIntegrations(t *testing.T) {
	// Every Mimir v0 integration with all its settings populated must pass the strict decode.
	for iType := range notifytest.AllValidMimirConfigs {
		t.Run(strings.TrimPrefix(iType.PkgPath(), "github.com/grafana/alerting/receivers/"), func(t *testing.T) {
			receiver, err := notifytest.GetMimirReceiverWithIntegrations([]reflect.Type{iType}, v0mimirtest.WithAuthorization)
			require.NoError(t, err)
			upstream := compat.DefinitionReceiverToUpstreamReceiver(receiver)

			// Secrets are masked by default and would not round-trip.
			prev := commoncfg.MarshalSecretValue
			commoncfg.MarshalSecretValue = true
			t.Cleanup(func() { commoncfg.MarshalSecretValue = prev })
			raw, err := yaml.Marshal(config.Config{
				Route:     &config.Route{Receiver: upstream.Name},
				Receivers: []config.Receiver{upstream},
			})
			require.NoError(t, err)

			cfg := ExtraConfiguration{Identifier: "test", AlertmanagerConfig: string(raw)}
			require.NoError(t, cfg.ValidateStrict())
		})
	}
}

func TestValidateStrict_SemanticErrorPrecedesUnknownFields(t *testing.T) {
	cfg := ExtraConfiguration{Identifier: "test", AlertmanagerConfig: `route: {receiver: a, typo: hidden}
receivers:
- name: a
  webhook_configs: [{}]
- name: b
  foo_configs: [{}]
`}
	err := cfg.ValidateStrict()
	require.ErrorContains(t, err, "one of url or url_file must be configured")
	require.NotContains(t, err.Error(), "foo_configs")
}

func TestValidateStrict_Whitespace(t *testing.T) {
	cfg := ExtraConfiguration{Identifier: "test", AlertmanagerConfig: " \n# comment\n"}
	require.ErrorContains(t, cfg.ValidateStrict(), "no route provided")
}

func TestValidate_StoredConfigRemainsLenient(t *testing.T) {
	cfg := ExtraConfiguration{Identifier: "test", AlertmanagerConfig: "route: {receiver: a}\nreceivers:\n  - name: a\n    foo_configs: [{}]\n"}
	_, err := cfg.GetAlertmanagerConfig()
	require.NoError(t, err)
	_, err = cfg.GetSanitizedAlertmanagerConfigYAML()
	require.NoError(t, err)
	require.NoError(t, cfg.Validate())
	require.ErrorContains(t, cfg.ValidateStrict(), "foo_configs")
}

func TestValidateStrict_UnknownFieldsHaveLineNumbers(t *testing.T) {
	cfg := ExtraConfiguration{Identifier: "test", AlertmanagerConfig: "route: {receiver: a}\nreceivers:\n  - name: a\n    foo_configs: [{}]\n"}
	require.ErrorContains(t, cfg.ValidateStrict(), "line 4")
}
