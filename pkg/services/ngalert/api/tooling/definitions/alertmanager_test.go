package definitions

import (
	"embed"
	"encoding/json"
	"path"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/grafana/alerting/definition"
	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.yaml.in/yaml/v3"

	"github.com/grafana/grafana/pkg/util"
)

//go:embed test-data/*.*
var testData embed.FS

func Test_GettableStatusUnmarshalJSON(t *testing.T) {
	incoming, err := testData.ReadFile(path.Join("test-data", "gettable-status.json"))
	require.Nil(t, err)

	var actual GettableStatus
	require.NoError(t, json.Unmarshal(incoming, &actual))

	actualJson, err := json.Marshal(actual)
	require.NoError(t, err)

	expected, err := testData.ReadFile(path.Join("test-data", "gettable-status-expected.json"))
	require.NoError(t, err)
	assert.JSONEq(t, string(expected), string(actualJson))

	v := reflect.ValueOf(actual.Config.Config)
	ty := v.Type()
	for i := 0; i < v.NumField(); i++ {
		field := v.Field(i)
		fieldName := ty.Field(i).Name
		assert.False(t, field.IsZero(), "Field %s should not be zero value", fieldName)
	}
}

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
	yamlEncoded, err := testData.ReadFile(path.Join("test-data", "alertmanager_test_artifact.yaml"))
	require.Nil(t, err)

	jsonEncoded, err := testData.ReadFile(path.Join("test-data", "alertmanager_test_artifact.json"))
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
	jsonEncoded, err := testData.ReadFile(path.Join("test-data", "alertmanager_test_artifact.json"))
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
		expected      MergeResult
	}{
		{
			name: "no extra configs",
			config: PostableUserConfig{
				AlertmanagerConfig: alertmanagerCfg,
			},
			expected: MergeResult{
				MergeResult: definition.MergeResult{
					Config: definition.PostableApiAlertingConfig{
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
					},
					RenameResources: definition.RenameResources{},
				},
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
  group_by: ['alertname']
  routes:
    - receiver: default
      matchers:
        - severity="critical"
receivers:
  - name: mimir-receiver
  - name: default`,
					},
				},
			},
			expected: MergeResult{
				MergeResult: definition.MergeResult{
					Config: definition.PostableApiAlertingConfig{
						Config: Config{
							Route: &Route{
								Receiver: "default",
								Routes: []*Route{
									{
										Matchers: []*labels.Matcher{
											{
												Type:  labels.MatchEqual,
												Name:  "cluster",
												Value: "prod",
											},
										},
										GroupInterval:  util.Pointer(model.Duration(5 * time.Minute)),
										GroupWait:      util.Pointer(model.Duration(30 * time.Second)),
										RepeatInterval: util.Pointer(model.Duration(4 * time.Hour)),
										Continue:       false,
										Receiver:       "mimir-receiver",
										GroupByStr:     []string{"alertname"},
										GroupBy:        []model.LabelName{"alertname"},
										Routes: []*Route{
											{
												Matchers: []*labels.Matcher{
													{
														Type:  labels.MatchEqual,
														Name:  "severity",
														Value: "critical",
													},
												},
												Receiver: "defaultmimir-1",
												Routes:   []*Route{},
											},
										},
									},
								},
							},
							InhibitRules:  []InhibitRule{},
							TimeIntervals: []config.TimeInterval{},
						},
						Receivers: []*PostableApiReceiver{
							{
								Receiver: config.Receiver{
									Name: "default",
								},
							},
							{
								Receiver: config.Receiver{
									Name: "mimir-receiver",
								},
							},
							{
								Receiver: config.Receiver{
									Name: "defaultmimir-1",
								},
							},
						},
					},
					RenameResources: definition.RenameResources{
						Receivers: map[string]string{
							"default": "defaultmimir-1",
						},
						TimeIntervals: map[string]string{},
					},
				},
				Identifier: "mimir-1",
				ExtraRoute: &Route{
					Receiver:   "mimir-receiver",
					GroupByStr: []string{"alertname"},
					GroupBy:    []model.LabelName{"alertname"},
					Routes: []*Route{
						{
							Matchers: []*labels.Matcher{
								{
									Type:  labels.MatchEqual,
									Name:  "severity",
									Value: "critical",
								},
							},
							Receiver: "defaultmimir-1",
							Routes:   []*Route{},
						},
					},
				},
			},
		},
		{
			name: "valid mimir config without merging matchers",
			config: PostableUserConfig{
				AlertmanagerConfig: alertmanagerCfg,
				ExtraConfigs: []ExtraConfiguration{
					{
						Identifier: "mimir-1",
						AlertmanagerConfig: `route:
  receiver: mimir-receiver
  group_by: ['alertname']
  routes:
    - receiver: default
      matchers:
        - severity="critical"
receivers:
  - name: mimir-receiver
  - name: default`,
					},
				},
			},
			expected: MergeResult{
				MergeResult: definition.MergeResult{
					Config: definition.PostableApiAlertingConfig{
						Config: Config{
							Route: &Route{
								Receiver: "default",
							},
							TimeIntervals: []config.TimeInterval{},
						},
						Receivers: []*PostableApiReceiver{
							{
								Receiver: config.Receiver{
									Name: "default",
								},
							},
							{
								Receiver: config.Receiver{
									Name: "mimir-receiver",
								},
							},
							{
								Receiver: config.Receiver{
									Name: "defaultmimir-1",
								},
							},
						},
					},
					RenameResources: definition.RenameResources{
						Receivers: map[string]string{
							"default": "defaultmimir-1",
						},
						TimeIntervals: map[string]string{},
					},
				},
				Identifier: "mimir-1",
				ExtraRoute: &Route{
					Receiver:   "mimir-receiver",
					GroupByStr: []string{"alertname"},
					GroupBy:    []model.LabelName{"alertname"},
					Routes: []*Route{
						{
							Matchers: []*labels.Matcher{
								{
									Type:  labels.MatchEqual,
									Name:  "severity",
									Value: "critical",
								},
							},
							Receiver: "defaultmimir-1",
							Routes:   []*Route{},
						},
					},
				},
			},
		},
		{
			name: "empty matchers and identifier",
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
			expectedError: "identifier is required",
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
			expectedError: "only matchers with type equal are supported",
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
				require.EqualValues(t, tc.expected, result)
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
