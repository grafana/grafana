package definitions

import (
	"encoding/json"
	"os"
	"strings"
	"testing"

	"github.com/grafana/alerting/definition"
	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/yaml.v3"
)

func Test_GettableUserConfigUnmarshaling(t *testing.T) {
	for _, tc := range []struct {
		desc, input string
		output      GettableUserConfig
		err         bool
	}{
		{
			desc:   "empty",
			input:  ``,
			output: GettableUserConfig{},
		},
		{
			desc: "empty-ish",
			input: `
template_files: {}
alertmanager_config: ""
`,
			output: GettableUserConfig{
				TemplateFiles: map[string]string{},
			},
		},
		{
			desc: "bad type for template",
			input: `
template_files: abc
alertmanager_config: ""
`,
			err: true,
		},
		{
			desc: "existing templates",
			input: `
template_files:
  foo: bar
alertmanager_config: ""
`,
			output: GettableUserConfig{
				TemplateFiles: map[string]string{"foo": "bar"},
			},
		},
		{
			desc: "existing templates inline",
			input: `
template_files: {foo: bar}
alertmanager_config: ""
`,
			output: GettableUserConfig{
				TemplateFiles: map[string]string{"foo": "bar"},
			},
		},
		{
			desc: "existing am config",
			input: `
template_files: {foo: bar}
alertmanager_config: |
                      route:
                          receiver: am
                          continue: false
                          routes:
                          - receiver: am
                            continue: false
                      templates: []
                      receivers:
                      - name: am
                        email_configs:
                        - to: foo
                          from: bar
                          headers:
                            Bazz: buzz
                          text: hi
                          html: there
`,
			output: GettableUserConfig{
				TemplateFiles: map[string]string{"foo": "bar"},
				AlertmanagerConfig: GettableApiAlertingConfig{
					Config: Config{
						Templates: []string{},
						Route: &Route{
							Receiver: "am",
							Routes: []*Route{
								{
									Receiver: "am",
								},
							},
						},
					},
					Receivers: []*GettableApiReceiver{
						{
							Receiver: config.Receiver{
								Name: "am",
								EmailConfigs: []*config.EmailConfig{{
									To:   "foo",
									From: "bar",
									Headers: map[string]string{
										"Bazz": "buzz",
									},
									Text: "hi",
									HTML: "there",
								}},
							},
						},
					},
				},
			},
		},
	} {
		t.Run(tc.desc, func(t *testing.T) {
			var out GettableUserConfig
			err := yaml.Unmarshal([]byte(tc.input), &out)
			if tc.err {
				require.Error(t, err)
				return
			}
			require.Nil(t, err)
			// Override the map[string]any field for test simplicity.
			// It's tested in Test_GettableUserConfigRoundtrip.
			out.amSimple = nil
			require.Equal(t, tc.output, out)
		})
	}
}

func Test_GettableUserConfigRoundtrip(t *testing.T) {
	// raw contains secret fields. We'll unmarshal, re-marshal, and ensure
	// the fields are not redacted.
	yamlEncoded, err := os.ReadFile("alertmanager_test_artifact.yaml")
	require.Nil(t, err)

	jsonEncoded, err := os.ReadFile("alertmanager_test_artifact.json")
	require.Nil(t, err)

	// test GettableUserConfig (yamlDecode -> jsonEncode)
	var tmp GettableUserConfig
	require.Nil(t, yaml.Unmarshal(yamlEncoded, &tmp))
	out, err := json.MarshalIndent(&tmp, "", "  ")
	require.Nil(t, err)
	require.Equal(t, strings.TrimSpace(string(jsonEncoded)), string(out))

	// test PostableUserConfig (jsonDecode -> yamlEncode)
	var tmp2 PostableUserConfig
	require.Nil(t, json.Unmarshal(jsonEncoded, &tmp2))
	out, err = yaml.Marshal(&tmp2)
	require.Nil(t, err)
	require.Equal(t, string(yamlEncoded), string(out))
}

func Test_Marshaling_Validation(t *testing.T) {
	jsonEncoded, err := os.ReadFile("alertmanager_test_artifact.json")
	require.Nil(t, err)

	var tmp GettableUserConfig
	require.Nil(t, json.Unmarshal(jsonEncoded, &tmp))

	expected := []model.LabelName{"alertname"}
	require.Equal(t, expected, tmp.AlertmanagerConfig.Route.GroupBy)
}

func Test_RawMessageMarshaling(t *testing.T) {
	type Data struct {
		Field RawMessage `json:"field" yaml:"field"`
	}

	t.Run("should unmarshal nil", func(t *testing.T) {
		v := Data{
			Field: nil,
		}
		data, err := json.Marshal(v)
		require.NoError(t, err)
		assert.JSONEq(t, `{ "field": null }`, string(data))

		var n Data
		require.NoError(t, json.Unmarshal(data, &n))
		assert.Equal(t, RawMessage("null"), n.Field)

		data, err = yaml.Marshal(&v)
		require.NoError(t, err)
		assert.Equal(t, "field: null\n", string(data))

		require.NoError(t, yaml.Unmarshal(data, &n))
		assert.Nil(t, n.Field)
	})

	t.Run("should unmarshal value", func(t *testing.T) {
		v := Data{
			Field: RawMessage(`{ "data": "test"}`),
		}
		data, err := json.Marshal(v)
		require.NoError(t, err)
		assert.JSONEq(t, `{"field":{"data":"test"}}`, string(data))

		var n Data
		require.NoError(t, json.Unmarshal(data, &n))
		assert.Equal(t, RawMessage(`{"data":"test"}`), n.Field)

		data, err = yaml.Marshal(&v)
		require.NoError(t, err)
		assert.Equal(t, "field:\n    data: test\n", string(data))

		require.NoError(t, yaml.Unmarshal(data, &n))
		assert.Equal(t, RawMessage(`{"data":"test"}`), n.Field)
	})
}

func TestPostableUserConfig_GetMergedAlertmanagerConfig(t *testing.T) {
	alertmanagerCfg := PostableApiAlertingConfig{
		Config: Config{
			Route: &Route{
				Receiver: "default",
			},
		},
		Receivers: []*PostableApiReceiver{
			{
				Receiver: config.Receiver{
					Name: "default",
				},
			},
		},
	}

	testCases := []struct {
		name          string
		config        PostableUserConfig
		expectedError string
	}{
		{
			name: "no extra configs",
			config: PostableUserConfig{
				AlertmanagerConfig: alertmanagerCfg,
			},
		},
		{
			name: "valid mimir config",
			config: PostableUserConfig{
				AlertmanagerConfig: alertmanagerCfg,
				ExtraConfigs: []ExtraConfiguration{
					{
						Identifier: "mimir-1",
						MergeMatchers: config.Matchers{
							{
								Type:  labels.MatchEqual,
								Name:  "cluster",
								Value: "prod",
							},
						},
						AlertmanagerConfig: `route:
  receiver: mimir-receiver
receivers:
  - name: mimir-receiver`,
					},
				},
			},
		},
		{
			name: "empty identifier",
			config: PostableUserConfig{
				AlertmanagerConfig: alertmanagerCfg,
				ExtraConfigs: []ExtraConfiguration{
					{
						Identifier:    "",
						MergeMatchers: config.Matchers{},
						AlertmanagerConfig: `{
							"route": {
								"receiver": "test"
							}
						}`,
					},
				},
			},
			expectedError: "invalid merge options",
		},
		{
			name: "bad matcher type",
			config: PostableUserConfig{
				AlertmanagerConfig: alertmanagerCfg,
				ExtraConfigs: []ExtraConfiguration{
					{
						Identifier: "test",
						MergeMatchers: config.Matchers{
							{
								Type:  labels.MatchNotEqual,
								Name:  "cluster",
								Value: "prod",
							},
						},
					},
				},
			},
			expectedError: "only equality matchers are allowed",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result, err := tc.config.GetMergedAlertmanagerConfig()
			if tc.expectedError != "" {
				require.Error(t, err)
				require.ErrorContains(t, err, tc.expectedError)
			} else {
				require.NoError(t, err)
				require.NotNil(t, result.Config)
			}
		})
	}
}

func TestPostableUserConfig_GetMergedTemplateDefinitions(t *testing.T) {
	testCases := []struct {
		name              string
		config            PostableUserConfig
		expectedTemplates int
	}{
		{
			name: "no templates",
			config: PostableUserConfig{
				TemplateFiles: map[string]string{},
				ExtraConfigs:  []ExtraConfiguration{},
			},
			expectedTemplates: 0,
		},
		{
			name: "grafana templates only",
			config: PostableUserConfig{
				TemplateFiles: map[string]string{
					"grafana-template1": "{{ define \"test\" }}Hello{{ end }}",
					"grafana-template2": "{{ define \"test2\" }}World{{ end }}",
				},
				ExtraConfigs: []ExtraConfiguration{},
			},
			expectedTemplates: 2,
		},
		{
			name: "mimir templates only",
			config: PostableUserConfig{
				TemplateFiles: map[string]string{},
				ExtraConfigs: []ExtraConfiguration{
					{
						TemplateFiles: map[string]string{
							"mimir-template": "{{ define \"mimir\" }}Mimir{{ end }}",
						},
					},
				},
			},
			expectedTemplates: 1,
		},
		{
			name: "mixed templates",
			config: PostableUserConfig{
				TemplateFiles: map[string]string{
					"grafana-template": "{{ define \"grafana\" }}Grafana{{ end }}",
				},
				ExtraConfigs: []ExtraConfiguration{
					{
						TemplateFiles: map[string]string{
							"mimir-template": "{{ define \"mimir\" }}Mimir{{ end }}",
						},
					},
				},
			},
			expectedTemplates: 2,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := tc.config.GetMergedTemplateDefinitions()
			require.Len(t, result, tc.expectedTemplates)

			templateMap := make(map[string]string)
			kindMap := make(map[string]definition.TemplateKind)
			for _, tmpl := range result {
				templateMap[tmpl.Name] = tmpl.Content
				kindMap[tmpl.Name] = tmpl.Kind
			}

			for name, content := range tc.config.TemplateFiles {
				require.Equal(t, content, templateMap[name])
				require.Equal(t, definition.GrafanaTemplateKind, kindMap[name])
			}

			if len(tc.config.ExtraConfigs) > 0 {
				for name, content := range tc.config.ExtraConfigs[0].TemplateFiles {
					require.Equal(t, content, templateMap[name])
					require.Equal(t, definition.MimirTemplateKind, kindMap[name])
				}
			}
		})
	}
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
				Identifier:    "test-config",
				MergeMatchers: config.Matchers{{Type: labels.MatchEqual, Name: "env", Value: "prod"}},
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
				MergeMatchers:      config.Matchers{{Type: labels.MatchEqual, Name: "env", Value: "prod"}},
				AlertmanagerConfig: `route: {receiver: default}`,
			},
			expectedError: "identifier is required",
		},
		{
			name: "invalid matcher type",
			config: ExtraConfiguration{
				Identifier:    "test-config",
				MergeMatchers: config.Matchers{{Type: labels.MatchNotEqual, Name: "env", Value: "prod"}},
				AlertmanagerConfig: `route:
  receiver: default
receivers:
  - name: default`,
			},
			expectedError: "only matchers with type equal are supported",
		},
		{
			name: "invalid YAML alertmanager config",
			config: ExtraConfiguration{
				Identifier:         "test-config",
				MergeMatchers:      config.Matchers{{Type: labels.MatchEqual, Name: "env", Value: "prod"}},
				AlertmanagerConfig: `invalid: yaml: content: [`,
			},
			expectedError: "failed to parse alertmanager config",
		},
		{
			name: "missing route in alertmanager config",
			config: ExtraConfiguration{
				Identifier:    "test-config",
				MergeMatchers: config.Matchers{{Type: labels.MatchEqual, Name: "env", Value: "prod"}},
				AlertmanagerConfig: `receivers:
  - name: default`,
			},
			expectedError: "no routes provided",
		},
		{
			name: "missing receivers in alertmanager config",
			config: ExtraConfiguration{
				Identifier:    "test-config",
				MergeMatchers: config.Matchers{{Type: labels.MatchEqual, Name: "env", Value: "prod"}},
				AlertmanagerConfig: `route:
  receiver: default`,
			},
			expectedError: "undefined receiver",
		},
		{
			name: "empty alertmanager config",
			config: ExtraConfiguration{
				Identifier:         "test-config",
				MergeMatchers:      config.Matchers{{Type: labels.MatchEqual, Name: "env", Value: "prod"}},
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
