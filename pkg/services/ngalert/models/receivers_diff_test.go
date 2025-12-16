package models

import (
	"slices"
	"testing"

	alertingNotify "github.com/grafana/alerting/notify"
	"github.com/grafana/alerting/receivers/schema"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestIntegrationDiff(t *testing.T) {
	s, _ := alertingNotify.GetSchemaVersionForIntegration("webhook", schema.V1)
	a := Integration{
		UID:                   "test-uid",
		Name:                  "test-name",
		Config:                s,
		DisableResolveMessage: false,
		Settings: map[string]any{
			"url":  "http://localhost",
			"name": 123,
			"flag": true,
			"child": map[string]any{
				"sub-form-field": "test",
			},
		},
		SecureSettings: map[string]string{
			"password": "12345",
			"token":    "token-12345",
		},
	}

	t.Run("no diff if equal", func(t *testing.T) {
		result := a.Diff(a)
		assert.Empty(t, result)
	})

	t.Run("should deep compare settings", func(t *testing.T) {
		b := a
		b.Settings = map[string]any{
			"url":  "http://localhost:123",
			"flag": false,
			"child": map[string]any{
				"sub-form-field": "test123",
				"sub-child": map[string]any{
					"test": "test",
				},
			},
		}

		result := a.Diff(b)
		assert.ElementsMatch(t,
			[]string{"Settings[url]", "Settings[name]", "Settings[flag]", "Settings[child][sub-form-field]", "Settings[child][sub-child]"},
			result.Paths())
	})

	t.Run("should shallow compare schemas", func(t *testing.T) {
		b := a
		b.Config, _ = alertingNotify.GetSchemaVersionForIntegration("slack", schema.V1)
		result := a.Diff(b)
		assert.ElementsMatch(t,
			[]string{"Config"},
			result.Paths())
	})

	t.Run("should compare with zero objects", func(t *testing.T) {
		result := a.Diff(Integration{})
		assert.ElementsMatch(t,
			[]string{
				"UID",
				"Name",
				"Config",
				"Settings[child]",
				"Settings[flag]",
				"Settings[name]",
				"Settings[url]",
				"SecureSettings[password]",
				"SecureSettings[token]",
			},
			result.Paths())
	})
}

func TestIntegrationDiffReport_GetSettingsPaths(t *testing.T) {
	a := Integration{
		UID:                   "test-uid",
		Name:                  "test-name",
		Config:                schema.IntegrationSchemaVersion{},
		DisableResolveMessage: false,
		Settings: map[string]any{
			"url": "http://localhost",
			"child": map[string]any{
				"field": "test",
				"sub-child": map[string]any{
					"test": "test",
				},
			},
		},
	}

	testCases := []struct {
		name  string
		left  map[string]any
		right map[string]any
		paths []string
	}{
		{
			name:  "empty",
			left:  map[string]any{},
			right: map[string]any{},
		},
		{
			name: "left is empty",
			left: map[string]any{},
			right: map[string]any{
				"field": "test",
			},
			paths: []string{"field"},
		},
		{
			name: "right is empty",
			left: map[string]any{
				"field": "test",
			},
			right: map[string]any{},
			paths: []string{"field"},
		},
		{
			name: "expands nested",
			left: map[string]any{
				"field": map[string]any{
					"sub-field": map[string]any{
						"test": "test",
					},
				},
			},
			right: map[string]any{
				"another": map[string]any{
					"sub-field": map[string]any{
						"test": "test",
					},
				},
			},
			paths: []string{
				"field.sub-field.test",
				"another.sub-field.test",
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			b := a
			b.Settings = tc.right
			a.Settings = tc.left
			diff := a.Diff(b)

			actual := diff.GetSettingsPaths()
			actualStrings := make([]string, 0, len(actual))
			for _, f := range actual {
				actualStrings = append(actualStrings, f.String())
			}
			assert.ElementsMatch(t, tc.paths, actualStrings)
		})
	}
}

func TestHasDifferentProtectedFields(t *testing.T) {
	m := IntegrationMuts

	testCase := []struct {
		name     string
		existing Integration
		incoming Integration
		expected map[string][]string
	}{
		{
			name:     "different UID do not match",
			existing: IntegrationGen(m.WithUID("existing"), m.WithValidConfig("webhook"))(),
			incoming: IntegrationGen(
				m.WithValidConfig("webhook"),
				m.AddSetting("url", "http://some-other-url"),
				m.WithUID("incoming"),
			)(),
			expected: nil,
		},
		{
			name:     "find url protected",
			existing: IntegrationGen(m.WithUID("1"), m.WithValidConfig("webhook"))(),
			incoming: IntegrationGen(
				m.WithValidConfig("webhook"),
				m.AddSetting("url", "http://some-other-url"),
				m.AddSetting("http_config", map[string]any{
					"oauth2": map[string]any{
						"proxy_config": map[string]any{
							"proxy_url": "http://some-other-url-proxy",
						},
						"token_url": "http://some-other-url-token",
					},
				}),
				m.WithUID("1"),
			)(),
			expected: map[string][]string{
				"1": {
					"http_config.oauth2.proxy_config.proxy_url",
					"http_config.oauth2.token_url",
					"url",
				},
			},
		},
		{
			name: "secure and protected", // simulate the situation when protected secured field is in secure settings but the incoming one has it in settings
			existing: IntegrationGen(
				m.WithUID("1"),
				m.WithValidConfig("discord"),
				m.RemoveSetting("url"),
				m.WithSecureSettings(map[string]string{
					"url": "<SECURED>",
				}))(),
			incoming: IntegrationGen(
				m.WithValidConfig("discord"),
				m.AddSetting("url", "http://some-other-url"),
				m.WithSecureSettings(nil),
				m.WithUID("1"),
			)(),
			expected: map[string][]string{
				"1": {
					"url",
				},
			},
		},
	}

	for _, tc := range testCase {
		t.Run(tc.name, func(t *testing.T) {
			existing := &Receiver{
				Integrations: []*Integration{
					&tc.existing,
				},
			}
			incoming := &Receiver{
				Integrations: []*Integration{
					&tc.incoming,
				},
			}
			actual := HasReceiversDifferentProtectedFields(existing, incoming)
			if len(tc.expected) == 0 {
				require.Empty(t, actual)
				return
			}
			actualStrings := make(map[string][]string, len(actual))
			for uid, paths := range actual {
				for _, path := range paths {
					actualStrings[uid] = append(actualStrings[uid], path.String())
				}
				slices.Sort(actualStrings[uid])
			}
			assert.EqualValues(t, tc.expected, actualStrings)
		})
	}
}
