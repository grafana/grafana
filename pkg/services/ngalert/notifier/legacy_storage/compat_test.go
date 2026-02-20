package legacy_storage

import (
	"errors"
	"fmt"
	"reflect"
	"testing"

	"github.com/grafana/alerting/definition"
	"github.com/grafana/alerting/notify"
	"github.com/grafana/alerting/notify/notifytest"
	"github.com/grafana/alerting/receivers/schema"
	"github.com/grafana/alerting/receivers/teams"
	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

func TestPostableMimirReceiverToIntegrations(t *testing.T) {
	t.Run("can convert all known types", func(t *testing.T) {
		notifytest.ForEachIntegrationTypeReceiver(t, func(configType reflect.Type, receiver notify.ConfigReceiver, rawConfig string) {
			expectedType, err := notify.IntegrationTypeFromMimirTypeReflect(configType)
			assert.NoError(t, err)
			expectedVersion := schema.V0mimir1
			if configType.Name() == "MSTeamsConfig" {
				expectedType = teams.Type
			}
			if configType.Name() == "MSTeamsV2Config" {
				expectedType = teams.Type
				expectedVersion = schema.V0mimir2
			}
			t.Run(fmt.Sprintf("%s as %s %s", configType.Name(), expectedType, expectedVersion), func(t *testing.T) {
				integrations, err := PostableMimirReceiverToIntegrations(receiver)
				require.NoError(t, err)
				require.Len(t, integrations, 1)
				integration := integrations[0]
				rawSettings, err := definition.MarshalJSONWithSecrets(integration.Settings)
				require.NoError(t, err)

				assert.EqualValues(t, expectedVersion, integration.Config.Version)
				assert.EqualValues(t, expectedType, integration.Config.Type())
				assert.JSONEq(t, rawConfig, string(rawSettings))
				assert.Empty(t, integration.SecureSettings)
			})
		})
	})

	t.Run("can convert receiver with all integrations", func(t *testing.T) {
		recv, err := notifytest.GetMimirReceiverWithAllIntegrations()
		require.NoError(t, err)
		integrations, err := PostableMimirReceiverToIntegrations(recv)
		require.NoError(t, err)
		require.Len(t, integrations, len(notifytest.AllValidMimirConfigs))
	})

	t.Run("returns empty if receiver has no integrations", func(t *testing.T) {
		integrations, err := PostableMimirReceiverToIntegrations(notify.ConfigReceiver{Name: "test"})
		require.NoError(t, err)
		require.Empty(t, integrations)
	})
}

func TestManagedRouteToRoute(t *testing.T) {
	gw := model.Duration(10)
	gi := model.Duration(20)
	ri := model.Duration(30)

	mr := &ManagedRoute{
		Name:           "test",
		Receiver:       "receiver",
		GroupBy:        []string{"alertname"},
		GroupWait:      &gw,
		GroupInterval:  &gi,
		RepeatInterval: &ri,
		Routes:         []*definition.Route{{Receiver: "child"}},
		Provenance:     models.Provenance("test"),
	}

	route := ManagedRouteToRoute(mr)

	assert.Equal(t, "receiver", route.Receiver)
	assert.Equal(t, []string{"alertname"}, route.GroupByStr)
	assert.Equal(t, &gw, route.GroupWait)
	assert.Equal(t, &gi, route.GroupInterval)
	assert.Equal(t, &ri, route.RepeatInterval)
	assert.Len(t, route.Routes, 1)
	assert.EqualValues(t, definitions.Provenance("test"), route.Provenance)
}

func Test_InhibitRuleToInhibitionRule(t *testing.T) {
	testRule := definitions.InhibitRule{
		SourceMatchers: config.Matchers{
			{
				Type:  labels.MatchEqual,
				Name:  "instance",
				Value: "alertmanager-1",
			},
		},
		TargetMatchers: config.Matchers{
			{
				Type:  labels.MatchEqual,
				Name:  "instance",
				Value: "alertmanager-2",
			},
		},
		Equal: []string{
			"service",
		},
	}

	tt := []struct {
		name        string
		ruleName    string
		provenance  definitions.Provenance
		inhibitRule definitions.InhibitRule
		origin      models.ResourceOrigin
		exp         *definitions.InhibitionRule
		expErr      error
	}{
		{
			name:     "fails when name is empty",
			ruleName: "  ",
			expErr:   errors.New("inhibition rule name must not be empty"),
		},
		{
			name:     "fails when name contains ':'",
			ruleName: "a:b",
			expErr:   errors.New("inhibition rule name cannot contain invalid character ':'"),
		},
		{
			name:     "fails when name is not a valid dns 1123 subdomain",
			ruleName: "_some_name",
			expErr:   errors.New("inhibition rule name must be a valid DNS subdomain: a lowercase RFC 1123 subdomain must consist of lower case alphanumeric characters, '-' or '.', and must start and end with an alphanumeric character (e.g. 'example.com', regex used for validation is '[a-z0-9]([-a-z0-9]*[a-z0-9])?(\\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*')"),
		},
		{
			name:     "fails when length of non-imported rule name is over UIDMaxLength limit",
			ruleName: "some-really-long-inhibition-rule-name-001",
			origin:   models.ResourceOriginGrafana,
			expErr:   errors.New("inhibition rule name is too long (exceeds 40 characters)"),
		},
		{
			name:        "allows length of imported rule name to be over UIDMaxLength limit",
			ruleName:    "some-really-long-inhibition-rule-name-001",
			provenance:  definitions.Provenance(models.ProvenanceConvertedPrometheus),
			origin:      models.ResourceOriginImported,
			inhibitRule: testRule,
			exp: &definitions.InhibitionRule{
				Name:        "some-really-long-inhibition-rule-name-001",
				InhibitRule: testRule,
				Provenance:  definitions.Provenance(models.ProvenanceConvertedPrometheus),
			},
		},
		{
			name:        "converts model correctly when all validations passes",
			ruleName:    "inhibition-rule-1",
			origin:      models.ResourceOriginGrafana,
			provenance:  definitions.Provenance(models.ProvenanceNone),
			inhibitRule: testRule,
			exp: &definitions.InhibitionRule{
				Name:        "inhibition-rule-1",
				InhibitRule: testRule,
				Provenance:  definitions.Provenance(models.ProvenanceNone),
			},
		},
	}

	for _, tc := range tt {
		t.Run(tc.name, func(t *testing.T) {
			got, gotErr := InhibitRuleToInhibitionRule(tc.ruleName, tc.inhibitRule, tc.provenance)
			if tc.expErr != nil {
				require.EqualError(t, gotErr, tc.expErr.Error())
			} else {
				require.Nil(t, gotErr)
			}
			require.Equal(t, tc.exp, got)
		})
	}
}
