package notifiers

import (
	"context"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/services/alerting/models"
	"github.com/grafana/grafana/pkg/services/annotations/annotationstest"
	encryptionservice "github.com/grafana/grafana/pkg/services/encryption/service"
	"github.com/grafana/grafana/pkg/services/tag"
	"github.com/grafana/grafana/pkg/services/validations"
)

func presenceComparer(a, b string) bool {
	if a == "<<PRESENCE>>" {
		return b != ""
	}
	if b == "<<PRESENCE>>" {
		return a != ""
	}
	return a == b
}

func TestPagerdutyNotifier(t *testing.T) {
	encryptionService := encryptionservice.SetupTestService(t)

	t.Run("empty settings should return error", func(t *testing.T) {
		json := `{ }`

		settingsJSON, err := simplejson.NewJson([]byte(json))
		require.Nil(t, err)

		model := &models.AlertNotification{
			Name:     "pageduty_testing",
			Type:     "pagerduty",
			Settings: settingsJSON,
		}

		_, err = NewPagerdutyNotifier(model, encryptionService.GetDecryptedValue, nil)
		require.Error(t, err)
	})

	t.Run("severity should override default", func(t *testing.T) {
		json := `{ "integrationKey": "abcdefgh0123456789", "severity": "info", "tags": ["foo"]}`

		settingsJSON, err := simplejson.NewJson([]byte(json))
		require.Nil(t, err)

		model := &models.AlertNotification{
			Name:     "pagerduty_testing",
			Type:     "pagerduty",
			Settings: settingsJSON,
		}

		not, err := NewPagerdutyNotifier(model, encryptionService.GetDecryptedValue, nil)
		pagerdutyNotifier := not.(*PagerdutyNotifier)

		require.Nil(t, err)
		require.Equal(t, "pagerduty_testing", pagerdutyNotifier.Name)
		require.Equal(t, "pagerduty", pagerdutyNotifier.Type)
		require.Equal(t, "abcdefgh0123456789", pagerdutyNotifier.Key)
		require.Equal(t, "info", pagerdutyNotifier.Severity)
		require.False(t, pagerdutyNotifier.AutoResolve)
	})

	t.Run("auto resolve and severity should have expected defaults", func(t *testing.T) {
		json := `{ "integrationKey": "abcdefgh0123456789" }`

		settingsJSON, err := simplejson.NewJson([]byte(json))
		require.Nil(t, err)

		model := &models.AlertNotification{
			Name:     "pagerduty_testing",
			Type:     "pagerduty",
			Settings: settingsJSON,
		}

		not, err := NewPagerdutyNotifier(model, encryptionService.GetDecryptedValue, nil)
		pagerdutyNotifier := not.(*PagerdutyNotifier)

		require.Nil(t, err)
		require.Equal(t, "pagerduty_testing", pagerdutyNotifier.Name)
		require.Equal(t, "pagerduty", pagerdutyNotifier.Type)
		require.Equal(t, "abcdefgh0123456789", pagerdutyNotifier.Key)
		require.Equal(t, "critical", pagerdutyNotifier.Severity)
		require.False(t, pagerdutyNotifier.AutoResolve)
	})

	t.Run("settings should trigger incident", func(t *testing.T) {
		json := `
				{
		  			"integrationKey": "abcdefgh0123456789",
					"autoResolve": false
				}`

		settingsJSON, err := simplejson.NewJson([]byte(json))
		require.Nil(t, err)

		model := &models.AlertNotification{
			Name:     "pagerduty_testing",
			Type:     "pagerduty",
			Settings: settingsJSON,
		}

		not, err := NewPagerdutyNotifier(model, encryptionService.GetDecryptedValue, nil)
		pagerdutyNotifier := not.(*PagerdutyNotifier)

		require.Nil(t, err)
		require.Equal(t, "pagerduty_testing", pagerdutyNotifier.Name)
		require.Equal(t, "pagerduty", pagerdutyNotifier.Type)
		require.Equal(t, "abcdefgh0123456789", pagerdutyNotifier.Key)
		require.False(t, pagerdutyNotifier.AutoResolve)
	})

	t.Run("should return properly formatted default v2 event payload", func(t *testing.T) {
		json := `{
					"integrationKey": "abcdefgh0123456789",
					"autoResolve": false
				}`

		settingsJSON, err := simplejson.NewJson([]byte(json))
		require.Nil(t, err)

		model := &models.AlertNotification{
			Name:     "pagerduty_testing",
			Type:     "pagerduty",
			Settings: settingsJSON,
		}

		not, err := NewPagerdutyNotifier(model, encryptionService.GetDecryptedValue, nil)
		require.Nil(t, err)

		pagerdutyNotifier := not.(*PagerdutyNotifier)
		evalContext := alerting.NewEvalContext(context.Background(), &alerting.Rule{
			ID:      0,
			Name:    "someRule",
			Message: "someMessage",
			State:   models.AlertStateAlerting,
		}, &validations.OSSPluginRequestValidator{}, nil, nil, nil, annotationstest.NewFakeAnnotationsRepo())
		evalContext.IsTestRun = true

		payloadJSON, err := pagerdutyNotifier.buildEventPayload(evalContext)
		require.Nil(t, err)
		payload, err := simplejson.NewJson(payloadJSON)
		require.Nil(t, err)

		diff := cmp.Diff(map[string]interface{}{
			"client":       "Grafana",
			"client_url":   "",
			"dedup_key":    "alertId-0",
			"event_action": "trigger",
			"links": []interface{}{
				map[string]interface{}{
					"href": "",
				},
			},
			"payload": map[string]interface{}{
				"component": "Grafana",
				"source":    "<<PRESENCE>>",
				"custom_details": map[string]interface{}{
					"state": "alerting",
				},
				"severity":  "critical",
				"summary":   "someRule - someMessage",
				"timestamp": "<<PRESENCE>>",
			},
			"routing_key": "abcdefgh0123456789",
		}, payload.Interface(), cmp.Comparer(presenceComparer))
		require.Empty(t, diff)
	})

	t.Run("should return properly formatted default v2 event payload with empty message", func(t *testing.T) {
		json := `{
					"integrationKey": "abcdefgh0123456789",
					"autoResolve": false
				}`

		settingsJSON, err := simplejson.NewJson([]byte(json))
		require.Nil(t, err)

		model := &models.AlertNotification{
			Name:     "pagerduty_testing",
			Type:     "pagerduty",
			Settings: settingsJSON,
		}

		not, err := NewPagerdutyNotifier(model, encryptionService.GetDecryptedValue, nil)
		require.Nil(t, err)

		pagerdutyNotifier := not.(*PagerdutyNotifier)
		evalContext := alerting.NewEvalContext(context.Background(), &alerting.Rule{
			ID:    0,
			Name:  "someRule",
			State: models.AlertStateAlerting,
		}, &validations.OSSPluginRequestValidator{}, nil, nil, nil, annotationstest.NewFakeAnnotationsRepo())
		evalContext.IsTestRun = true

		payloadJSON, err := pagerdutyNotifier.buildEventPayload(evalContext)
		require.Nil(t, err)
		payload, err := simplejson.NewJson(payloadJSON)
		require.Nil(t, err)

		diff := cmp.Diff(map[string]interface{}{
			"client":       "Grafana",
			"client_url":   "",
			"dedup_key":    "alertId-0",
			"event_action": "trigger",
			"links": []interface{}{
				map[string]interface{}{
					"href": "",
				},
			},
			"payload": map[string]interface{}{
				"component": "Grafana",
				"source":    "<<PRESENCE>>",
				"custom_details": map[string]interface{}{
					"state": "alerting",
				},
				"severity":  "critical",
				"summary":   "someRule",
				"timestamp": "<<PRESENCE>>",
			},
			"routing_key": "abcdefgh0123456789",
		}, payload.Interface(), cmp.Comparer(presenceComparer))
		require.Empty(t, diff)
	})

	t.Run("should return properly formatted payload with message moved to details", func(t *testing.T) {
		json := `{
					"integrationKey": "abcdefgh0123456789",
					"autoResolve": false,
					"messageInDetails": true
				}`

		settingsJSON, err := simplejson.NewJson([]byte(json))
		require.Nil(t, err)

		model := &models.AlertNotification{
			Name:     "pagerduty_testing",
			Type:     "pagerduty",
			Settings: settingsJSON,
		}

		not, err := NewPagerdutyNotifier(model, encryptionService.GetDecryptedValue, nil)
		require.Nil(t, err)

		pagerdutyNotifier := not.(*PagerdutyNotifier)
		evalContext := alerting.NewEvalContext(context.Background(), &alerting.Rule{
			ID:      0,
			Name:    "someRule",
			Message: "someMessage",
			State:   models.AlertStateAlerting,
		}, &validations.OSSPluginRequestValidator{}, nil, nil, nil, annotationstest.NewFakeAnnotationsRepo())
		evalContext.IsTestRun = true
		evalContext.EvalMatches = []*alerting.EvalMatch{
			{
				// nil is a terrible value to test with, but the cmp.Diff doesn't
				// like comparing actual floats. So this is roughly the equivalent
				// of <<PRESENCE>>
				Value:  null.FloatFromPtr(nil),
				Metric: "someMetric",
			},
		}

		payloadJSON, err := pagerdutyNotifier.buildEventPayload(evalContext)
		require.NoError(t, err)
		payload, err := simplejson.NewJson(payloadJSON)
		require.NoError(t, err)

		diff := cmp.Diff(map[string]interface{}{
			"client":       "Grafana",
			"client_url":   "",
			"dedup_key":    "alertId-0",
			"event_action": "trigger",
			"links": []interface{}{
				map[string]interface{}{
					"href": "",
				},
			},
			"payload": map[string]interface{}{
				"component": "Grafana",
				"source":    "<<PRESENCE>>",
				"custom_details": map[string]interface{}{
					"message": "someMessage",
					"queries": map[string]interface{}{
						"someMetric": nil,
					},
					"state": "alerting",
				},
				"severity":  "critical",
				"summary":   "someRule",
				"timestamp": "<<PRESENCE>>",
			},
			"routing_key": "abcdefgh0123456789",
		}, payload.Interface(), cmp.Comparer(presenceComparer))
		require.Empty(t, diff)
	})

	t.Run("should return properly formatted v2 event payload when using override tags", func(t *testing.T) {
		json := `{
					"integrationKey": "abcdefgh0123456789",
					"autoResolve": false
				}`

		settingsJSON, err := simplejson.NewJson([]byte(json))
		require.NoError(t, err)

		model := &models.AlertNotification{
			Name:     "pagerduty_testing",
			Type:     "pagerduty",
			Settings: settingsJSON,
		}

		not, err := NewPagerdutyNotifier(model, encryptionService.GetDecryptedValue, nil)
		require.NoError(t, err)

		pagerdutyNotifier := not.(*PagerdutyNotifier)

		evalContext := alerting.NewEvalContext(context.Background(), &alerting.Rule{
			ID:      0,
			Name:    "someRule",
			Message: "someMessage",
			State:   models.AlertStateAlerting,
			AlertRuleTags: []*tag.Tag{
				{Key: "keyOnly"},
				{Key: "group", Value: "aGroup"},
				{Key: "class", Value: "aClass"},
				{Key: "component", Value: "aComponent"},
				{Key: "severity", Value: "warning"},
				{Key: "dedup_key", Value: "key-" + strings.Repeat("x", 260)},
			},
		}, &validations.OSSPluginRequestValidator{}, nil, nil, nil, annotationstest.NewFakeAnnotationsRepo())
		evalContext.ImagePublicURL = "http://somewhere.com/omg_dont_panic.png"
		evalContext.IsTestRun = true

		payloadJSON, err := pagerdutyNotifier.buildEventPayload(evalContext)
		require.NoError(t, err)
		payload, err := simplejson.NewJson(payloadJSON)
		require.NoError(t, err)

		diff := cmp.Diff(map[string]interface{}{
			"client":       "Grafana",
			"client_url":   "",
			"dedup_key":    "key-" + strings.Repeat("x", 250),
			"event_action": "trigger",
			"links": []interface{}{
				map[string]interface{}{
					"href": "",
				},
			},
			"payload": map[string]interface{}{
				"source":    "<<PRESENCE>>",
				"component": "aComponent",
				"custom_details": map[string]interface{}{
					"group":     "aGroup",
					"class":     "aClass",
					"component": "aComponent",
					"severity":  "warning",
					"dedup_key": "key-" + strings.Repeat("x", 250),
					"keyOnly":   "",
					"state":     "alerting",
				},
				"severity":  "warning",
				"summary":   "someRule - someMessage",
				"timestamp": "<<PRESENCE>>",
				"class":     "aClass",
				"group":     "aGroup",
			},
			"images": []interface{}{
				map[string]interface{}{
					"src": "http://somewhere.com/omg_dont_panic.png",
				},
			},
			"routing_key": "abcdefgh0123456789",
		}, payload.Interface(), cmp.Comparer(presenceComparer))
		require.Empty(t, diff)
	})

	t.Run("should support multiple levels of severity", func(t *testing.T) {
		json := `{
					"integrationKey": "abcdefgh0123456789",
					"autoResolve": false
				}`

		settingsJSON, err := simplejson.NewJson([]byte(json))
		require.NoError(t, err)

		model := &models.AlertNotification{
			Name:     "pagerduty_testing",
			Type:     "pagerduty",
			Settings: settingsJSON,
		}

		not, err := NewPagerdutyNotifier(model, encryptionService.GetDecryptedValue, nil)
		require.NoError(t, err)

		pagerdutyNotifier := not.(*PagerdutyNotifier)

		evalContext := alerting.NewEvalContext(context.Background(), &alerting.Rule{
			ID:      0,
			Name:    "someRule",
			Message: "someMessage",
			State:   models.AlertStateAlerting,
			AlertRuleTags: []*tag.Tag{
				{Key: "keyOnly"},
				{Key: "group", Value: "aGroup"},
				{Key: "class", Value: "aClass"},
				{Key: "component", Value: "aComponent"},
				{Key: "severity", Value: "info"},
			},
		}, &validations.OSSPluginRequestValidator{}, nil, nil, nil, annotationstest.NewFakeAnnotationsRepo())
		evalContext.ImagePublicURL = "http://somewhere.com/omg_dont_panic.png"
		evalContext.IsTestRun = true

		payloadJSON, err := pagerdutyNotifier.buildEventPayload(evalContext)
		require.NoError(t, err)
		payload, err := simplejson.NewJson(payloadJSON)
		require.NoError(t, err)

		diff := cmp.Diff(map[string]interface{}{
			"client":       "Grafana",
			"client_url":   "",
			"dedup_key":    "alertId-0",
			"event_action": "trigger",
			"links": []interface{}{
				map[string]interface{}{
					"href": "",
				},
			},
			"payload": map[string]interface{}{
				"source":    "<<PRESENCE>>",
				"component": "aComponent",
				"custom_details": map[string]interface{}{
					"group":     "aGroup",
					"class":     "aClass",
					"component": "aComponent",
					"severity":  "info",
					"keyOnly":   "",
					"state":     "alerting",
				},
				"severity":  "info",
				"summary":   "someRule - someMessage",
				"timestamp": "<<PRESENCE>>",
				"class":     "aClass",
				"group":     "aGroup",
			},
			"images": []interface{}{
				map[string]interface{}{
					"src": "http://somewhere.com/omg_dont_panic.png",
				},
			},
			"routing_key": "abcdefgh0123456789",
		}, payload.Interface(), cmp.Comparer(presenceComparer))
		require.Empty(t, diff)
	})

	t.Run("should ignore invalid severity for PD but keep the tag", func(t *testing.T) {
		json := `{
					"integrationKey": "abcdefgh0123456789",
					"autoResolve": false,
					"severity": "critical"
				}`

		settingsJSON, err := simplejson.NewJson([]byte(json))
		require.NoError(t, err)

		model := &models.AlertNotification{
			Name:     "pagerduty_testing",
			Type:     "pagerduty",
			Settings: settingsJSON,
		}

		not, err := NewPagerdutyNotifier(model, encryptionService.GetDecryptedValue, nil)
		require.NoError(t, err)

		pagerdutyNotifier := not.(*PagerdutyNotifier)

		evalContext := alerting.NewEvalContext(context.Background(), &alerting.Rule{
			ID:      0,
			Name:    "someRule",
			Message: "someMessage",
			State:   models.AlertStateAlerting,
			AlertRuleTags: []*tag.Tag{
				{Key: "keyOnly"},
				{Key: "group", Value: "aGroup"},
				{Key: "class", Value: "aClass"},
				{Key: "component", Value: "aComponent"},
				{Key: "severity", Value: "llama"},
			},
		}, &validations.OSSPluginRequestValidator{}, nil, nil, nil, annotationstest.NewFakeAnnotationsRepo())
		evalContext.ImagePublicURL = "http://somewhere.com/omg_dont_panic.png"
		evalContext.IsTestRun = true

		payloadJSON, err := pagerdutyNotifier.buildEventPayload(evalContext)
		require.NoError(t, err)
		payload, err := simplejson.NewJson(payloadJSON)
		require.NoError(t, err)

		diff := cmp.Diff(map[string]interface{}{
			"client":       "Grafana",
			"client_url":   "",
			"dedup_key":    "alertId-0",
			"event_action": "trigger",
			"links": []interface{}{
				map[string]interface{}{
					"href": "",
				},
			},
			"payload": map[string]interface{}{
				"source":    "<<PRESENCE>>",
				"component": "aComponent",
				"custom_details": map[string]interface{}{
					"group":     "aGroup",
					"class":     "aClass",
					"component": "aComponent",
					"severity":  "llama",
					"keyOnly":   "",
					"state":     "alerting",
				},
				"severity":  "critical",
				"summary":   "someRule - someMessage",
				"timestamp": "<<PRESENCE>>",
				"class":     "aClass",
				"group":     "aGroup",
			},
			"images": []interface{}{
				map[string]interface{}{
					"src": "http://somewhere.com/omg_dont_panic.png",
				},
			},
			"routing_key": "abcdefgh0123456789",
		}, payload.Interface(), cmp.Comparer(presenceComparer))
		require.Empty(t, diff)
	})
}
