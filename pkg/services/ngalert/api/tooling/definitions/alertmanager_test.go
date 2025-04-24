package definitions

import (
	"encoding/json"
	"os"
	"strings"
	"testing"

	"github.com/prometheus/alertmanager/config"
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
