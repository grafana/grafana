package api

import (
	"encoding/base64"
	"reflect"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	alertingmodels "github.com/grafana/alerting/models"
	alertingNotify "github.com/grafana/alerting/notify"
	"github.com/grafana/alerting/notify/notifytest"
	"github.com/grafana/alerting/receivers/schema"

	apicompat "github.com/grafana/grafana/pkg/services/ngalert/api/compat"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
)

// knownSchemaTypos lists (integration type, PropertyName) pairs where alerting's v1 schema declares a field name
// that doesn't match the actual JSON key its Config struct reads, so the check below would otherwise flag a false
// gap in definitions.go. These are upstream bugs in github.com/grafana/alerting, not fixable from this repo.
var knownSchemaTypos = map[schema.IntegrationType]map[string]bool{
	schema.TelegramType: {
		// grafana/alerting's telegram v1 schema declares PropertyName "disable_notification" but
		// Config.DisableNotifications actually reads "disable_notifications" (typo introduced in
		// alerting@3da3b9a5, "Improve schemas"). The UI checkbox for this field is currently a no-op.
		// Fix upstream, then remove this entry.
		"disable_notification": true,
	},
}

// TestContactPointDefinitionsMatchSchema asserts that every field declared in the v1 schema of an integration
// (github.com/grafana/alerting) has a matching field in the corresponding definitions.XXXIntegration struct below.
// Without this check, a new or renamed field in alerting's schema could silently fail to round-trip through
// Grafana's contact point API (provisioning, export, Terraform) without any test noticing.
func TestContactPointDefinitionsMatchSchema(t *testing.T) {
	for _, integrationSchema := range alertingNotify.GetSchemaForAllIntegrations() {
		v1, ok := integrationSchema.GetVersion(schema.V1)
		if !ok {
			continue
		}
		t.Run(string(integrationSchema.Type), func(t *testing.T) {
			goType := definitionsStructFor(t, integrationSchema.Type)
			assertFieldsMatchSchema(t, integrationSchema.Type, v1.Options, goType)
		})
	}
}

// definitionsStructFor returns the definitions.XXXIntegration struct type that
// ContactPointFromContactPointExport populates for the given integration type.
func definitionsStructFor(t *testing.T, integrationType schema.IntegrationType) reflect.Type {
	t.Helper()
	export := definitions.ContactPointExport{
		Receivers: []definitions.ReceiverExport{{Type: string(integrationType), Settings: definitions.RawMessage(`{}`)}},
	}
	cp, err := ContactPointFromContactPointExport(export)
	require.NoError(t, err)

	for _, f := range reflect.ValueOf(cp).Fields() {
		if f.Kind() == reflect.Slice && f.Len() == 1 {
			return f.Index(0).Type()
		}
	}
	t.Fatalf("no definitions.ContactPoint field is populated for integration type %q; add it to ContactPointFromContactPointExport", integrationType)
	return nil
}

// assertFieldsMatchSchema asserts that every field declared in fields has a matching JSON field in goType,
// recursing into the nested struct for subform fields.
func assertFieldsMatchSchema(t *testing.T, integrationType schema.IntegrationType, fields []schema.Field, goType reflect.Type) {
	t.Helper()
	for _, field := range fields {
		if knownSchemaTypos[integrationType][field.PropertyName] {
			continue
		}
		structField, ok := jsonField(goType, field.PropertyName)
		if !assert.Truef(t, ok, "%s: schema field %q has no matching field in definitions.%s", integrationType, field.PropertyName, goType.Name()) {
			continue
		}
		if field.Element != schema.ElementTypeSubform {
			continue
		}
		nested := structType(structField.Type)
		if !assert.NotNilf(t, nested, "%s: schema field %q is a subform but definitions.%s.%s is not a struct", integrationType, field.PropertyName, goType.Name(), structField.Name) {
			continue
		}
		assertFieldsMatchSchema(t, integrationType, field.SubformOptions, nested)
	}
}

// jsonField returns the field of struct type t whose JSON tag matches name.
func jsonField(t reflect.Type, name string) (reflect.StructField, bool) {
	for f := range t.Fields() {
		tag, ok := f.Tag.Lookup("json")
		if !ok {
			continue
		}
		tagName, _, _ := strings.Cut(tag, ",")
		if tagName == name {
			return f, true
		}
	}
	return reflect.StructField{}, false
}

// structType returns the underlying struct type of t (dereferencing a pointer), or nil if t is not a struct.
func structType(t reflect.Type) reflect.Type {
	if t.Kind() == reflect.Pointer {
		t = t.Elem()
	}
	if t.Kind() == reflect.Struct {
		return t
	}
	return nil
}

// TestContactPointRoundTrip complements TestContactPointDefinitionsMatchSchema: that test checks the definitions
// structs declare every field the schema knows about, but says nothing about whether values actually survive the
// conversion (ContactPointToContactPointExport, the custom jsoniter codecs, secret-setting handling). This test
// covers that: it converts a fully-populated config to a typed ContactPoint and back to raw settings, then
// re-imports those raw settings and asserts the result is unchanged. A field that is declared but dropped or
// mis-serialized during the round trip will show up as a diff here.
func TestContactPointRoundTrip(t *testing.T) {
	getContactPointExport := func(t *testing.T, receiver *alertingmodels.ReceiverConfig) definitions.ContactPointExport {
		export := make([]definitions.ReceiverExport, 0, len(receiver.Integrations))
		for _, integrationConfig := range receiver.Integrations {
			postable := &definitions.PostableGrafanaReceiver{
				UID:                   integrationConfig.UID,
				Name:                  integrationConfig.Name,
				Type:                  string(integrationConfig.Type),
				Version:               string(integrationConfig.Version),
				DisableResolveMessage: integrationConfig.DisableResolveMessage,
				Settings:              definitions.RawMessage(integrationConfig.Settings),
				SecureSettings:        integrationConfig.SecureSettings,
			}
			emb, err := provisioning.PostableGrafanaReceiverToEmbeddedContactPoint(
				postable,
				models.ProvenanceNone,
				func(s string) string { // test configs are not encrypted but encoded
					d, err := base64.StdEncoding.DecodeString(s)
					require.NoError(t, err)
					return string(d)
				})
			require.NoError(t, err)
			ex, err := apicompat.ReceiverExportFromEmbeddedContactPoint(emb)
			require.NoError(t, err)
			export = append(export, ex)
		}

		return definitions.ContactPointExport{
			OrgID:     1,
			Name:      receiver.Name,
			Receivers: export,
		}
	}

	// use the configs for testing because they have all fields supported by integrations
	for integrationType, cfg := range notifytest.AllKnownV1ConfigsForTesting {
		t.Run(string(integrationType), func(t *testing.T) {
			recCfg := &alertingmodels.ReceiverConfig{
				Name: "test-receiver",
				Integrations: []*alertingmodels.IntegrationConfig{
					cfg.GetRawNotifierConfig("test"),
				},
			}

			expected, err := ContactPointFromContactPointExport(getContactPointExport(t, recCfg))
			require.NoError(t, err)

			back, err := ContactPointToContactPointExport(expected)
			require.NoError(t, err)

			// Run the export/import conversion a second time on the round-tripped config. If the conversion
			// lost or altered any data, re-importing it will no longer match `expected`.
			actual, err := ContactPointFromContactPointExport(getContactPointExport(t, &back))
			require.NoError(t, err)

			diff := cmp.Diff(expected, actual)
			if len(diff) != 0 {
				require.Failf(t, "The re-marshalled configuration does not match the expected one", diff)
			}
		})
	}
}

func TestContactPointFromContactPointExport(t *testing.T) {
	t.Run("pushover optional numbers as string", func(t *testing.T) {
		export := definitions.ContactPointExport{
			Name: "test",
			Receivers: []definitions.ReceiverExport{
				{
					Type: "pushover",
					Settings: definitions.RawMessage(
						`{
						"priority": 1,
						"okPriority": "2",
						"expire": null,
						"retry": "invalid"
					}`),
				},
			},
		}
		result, err := ContactPointFromContactPointExport(export)
		require.NoError(t, err)
		require.Len(t, result.Pushover, 1)
		require.Equal(t, int64(1), *result.Pushover[0].AlertingPriority)
		require.Equal(t, int64(2), *result.Pushover[0].OKPriority)
		require.Nil(t, result.Pushover[0].Expire)
		require.Nil(t, result.Pushover[0].Retry)
	})
	t.Run("email with multiple addresses", func(t *testing.T) {
		export := definitions.ContactPointExport{
			Name: "test",
			Receivers: []definitions.ReceiverExport{
				{
					Type:     "email",
					Settings: definitions.RawMessage(`{"addresses": "test@grafana.com,test2@grafana.com;test3@grafana.com\ntest4@granafa.com"}`),
				},
			},
		}
		result, err := ContactPointFromContactPointExport(export)
		require.NoError(t, err)
		require.Len(t, result.Email, 1)
		require.EqualValues(t, []string{
			"test@grafana.com",
			"test2@grafana.com",
			"test3@grafana.com",
			"test4@granafa.com",
		}, result.Email[0].Addresses)
	})
	t.Run("webhook with optional numbers as string", func(t *testing.T) {
		export := definitions.ContactPointExport{
			Name: "test",
			Receivers: []definitions.ReceiverExport{
				{
					Type:     "webhook",
					Settings: definitions.RawMessage(`{ "maxAlerts" : "112" }`),
				},
				{
					Type:     "webhook",
					Settings: definitions.RawMessage(`{ "maxAlerts" : "test" }`),
				},
				{
					Type:     "webhook",
					Settings: definitions.RawMessage(`{ "maxAlerts" : null }`),
				},
			},
		}
		result, err := ContactPointFromContactPointExport(export)
		require.NoError(t, err)
		require.Len(t, result.Webhook, 3)
		require.Equal(t, int64(112), *result.Webhook[0].MaxAlerts)
		require.Nil(t, result.Webhook[1].MaxAlerts)
		require.Nil(t, result.Webhook[2].MaxAlerts)
	})

	t.Run("oncall with optional numbers as string", func(t *testing.T) {
		export := definitions.ContactPointExport{
			Name: "test",
			Receivers: []definitions.ReceiverExport{
				{
					Type:     "oncall",
					Settings: definitions.RawMessage(`{ "maxAlerts" : "112" }`),
				},
				{
					Type:     "oncall",
					Settings: definitions.RawMessage(`{ "maxAlerts" : "test" }`),
				},
				{
					Type:     "oncall",
					Settings: definitions.RawMessage(`{ "maxAlerts" : null }`),
				},
			},
		}
		result, err := ContactPointFromContactPointExport(export)
		require.NoError(t, err)
		require.Len(t, result.OnCall, 3)
		require.Equal(t, int64(112), *result.OnCall[0].MaxAlerts)
		require.Nil(t, result.OnCall[1].MaxAlerts)
		require.Nil(t, result.OnCall[2].MaxAlerts)
	})

	t.Run("mqtt with optional numbers as string", func(t *testing.T) {
		export := definitions.ContactPointExport{
			Name: "test",
			Receivers: []definitions.ReceiverExport{
				{
					Type:     "mqtt",
					Settings: definitions.RawMessage(`{ "qos" : "112" }`),
				},
				{
					Type:     "mqtt",
					Settings: definitions.RawMessage(`{ "qos" : "test" }`),
				},
				{
					Type:     "mqtt",
					Settings: definitions.RawMessage(`{ "qos" : null }`),
				},
			},
		}
		result, err := ContactPointFromContactPointExport(export)
		require.NoError(t, err)
		require.Len(t, result.Mqtt, 3)
		require.Equal(t, int64(112), *result.Mqtt[0].QoS)
		require.Nil(t, result.Mqtt[1].QoS)
		require.Nil(t, result.Mqtt[2].QoS)
	})

	t.Run("jira with various fields values as string", func(t *testing.T) {
		testcases := []struct {
			name        string
			input       definitions.RawMessage
			expected    *string
			expectedErr bool
		}{
			{
				name:     "standard map[string]string",
				input:    definitions.RawMessage(`{ "fields" : {"test-data" : "test-value"} }`),
				expected: new(`{"test-data":"test-value"}`),
			},
			{
				name:     "map[string]int",
				input:    definitions.RawMessage(`{ "fields" : {"test-data" : 42} }`),
				expected: new(`{"test-data":42}`),
			},
			{
				name:     "map[string]interface{} with null value",
				input:    definitions.RawMessage(`{ "fields" : {"test-data" : null} }`),
				expected: new(`{"test-data":null}`),
			},
			{
				name:     "null fields",
				input:    definitions.RawMessage(`{ "fields" : null }`),
				expected: nil,
			},
			{
				name:     "empty map",
				input:    definitions.RawMessage(`{ "fields" : {} }`),
				expected: new(`{}`),
			},
			{
				name:     "nested map",
				input:    definitions.RawMessage(`{ "fields" : {"test-data" : {"test-data-nested" : "test-value-nested"}} }`),
				expected: new(`{"test-data":{"test-data-nested":"test-value-nested"}}`),
			},
			{
				name:     "nested slice",
				input:    definitions.RawMessage(`{ "fields" : {"test-data" : ["slice1", "slice2"]} }`),
				expected: new(`{"test-data":["slice1","slice2"]}`),
			},
			{
				name:        "string value",
				input:       definitions.RawMessage(`{ "fields" : "some string" }`),
				expectedErr: true,
			},
			{
				name:        "slice",
				input:       definitions.RawMessage(`{ "fields" : ["slice1", "slice2"} }`),
				expectedErr: true,
			},
		}
		for _, tc := range testcases {
			t.Run(tc.name, func(t *testing.T) {
				export := definitions.ContactPointExport{
					Name: "test",
					Receivers: []definitions.ReceiverExport{
						{
							Type:     "jira",
							Settings: tc.input,
						},
					},
				}

				result, err := ContactPointFromContactPointExport(export)
				if tc.expectedErr {
					require.Error(t, err, "Expected error for input: %s", tc.input)
					return
				} else {
					require.NoError(t, err, "Unexpected error for input: %s", tc.input)
				}
				require.Len(t, result.Jira, 1)

				if tc.expected == nil {
					require.Nil(t, result.Jira[0].Fields)
				} else {
					require.Equal(t, *tc.expected, *result.Jira[0].Fields)
				}
			})
		}
	})
}
