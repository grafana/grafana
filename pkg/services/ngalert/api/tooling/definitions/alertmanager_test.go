package definitions

import (
	"encoding/json"
	"io/ioutil"
	"strings"
	"testing"

	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/yaml.v3"
)

func Test_ApiReceiver_Marshaling(t *testing.T) {
	for _, tc := range []struct {
		desc  string
		input PostableApiReceiver
		err   bool
	}{
		{
			desc: "success AM",
			input: PostableApiReceiver{
				Receiver: config.Receiver{
					Name:         "foo",
					EmailConfigs: []*config.EmailConfig{{}},
				},
			},
		},
		{
			desc: "success GM",
			input: PostableApiReceiver{
				Receiver: config.Receiver{
					Name: "foo",
				},
				PostableGrafanaReceivers: PostableGrafanaReceivers{
					GrafanaManagedReceivers: []*PostableGrafanaReceiver{{}},
				},
			},
		},
		{
			desc: "failure mixed",
			input: PostableApiReceiver{
				Receiver: config.Receiver{
					Name:         "foo",
					EmailConfigs: []*config.EmailConfig{{}},
				},
				PostableGrafanaReceivers: PostableGrafanaReceivers{
					GrafanaManagedReceivers: []*PostableGrafanaReceiver{{}},
				},
			},
			err: true,
		},
	} {
		t.Run(tc.desc, func(t *testing.T) {
			encoded, err := json.Marshal(tc.input)
			require.Nil(t, err)

			var out PostableApiReceiver
			err = json.Unmarshal(encoded, &out)

			if tc.err {
				require.Error(t, err)
			} else {
				require.Nil(t, err)
				require.Equal(t, tc.input, out)
			}
		})
	}
}

func Test_APIReceiverType(t *testing.T) {
	for _, tc := range []struct {
		desc     string
		input    PostableApiReceiver
		expected ReceiverType
	}{
		{
			desc: "empty",
			input: PostableApiReceiver{
				Receiver: config.Receiver{
					Name: "foo",
				},
			},
			expected: EmptyReceiverType,
		},
		{
			desc: "am",
			input: PostableApiReceiver{
				Receiver: config.Receiver{
					Name:         "foo",
					EmailConfigs: []*config.EmailConfig{{}},
				},
			},
			expected: AlertmanagerReceiverType,
		},
		{
			desc: "graf",
			input: PostableApiReceiver{
				Receiver: config.Receiver{
					Name: "foo",
				},
				PostableGrafanaReceivers: PostableGrafanaReceivers{
					GrafanaManagedReceivers: []*PostableGrafanaReceiver{{}},
				},
			},
			expected: GrafanaReceiverType,
		},
	} {
		t.Run(tc.desc, func(t *testing.T) {
			require.Equal(t, tc.expected, tc.input.Type())
		})
	}
}

func Test_AllReceivers(t *testing.T) {
	input := &config.Route{
		Receiver: "foo",
		Routes: []*config.Route{
			{
				Receiver: "bar",
				Routes: []*config.Route{
					{
						Receiver: "bazz",
					},
				},
			},
			{
				Receiver: "buzz",
			},
		},
	}

	require.Equal(t, []string{"foo", "bar", "bazz", "buzz"}, AllReceivers(input))

	// test empty
	var empty []string
	require.Equal(t, empty, AllReceivers(&config.Route{}))
}

func Test_ApiAlertingConfig_Marshaling(t *testing.T) {
	for _, tc := range []struct {
		desc  string
		input PostableApiAlertingConfig
		err   bool
	}{
		{
			desc: "success am",
			input: PostableApiAlertingConfig{
				Config: Config{
					Route: &config.Route{
						Receiver: "am",
						Routes: []*config.Route{
							{
								Receiver: "am",
							},
						},
					},
				},
				Receivers: []*PostableApiReceiver{
					{
						Receiver: config.Receiver{
							Name:         "am",
							EmailConfigs: []*config.EmailConfig{{}},
						},
					},
				},
			},
		},
		{
			desc: "success graf",
			input: PostableApiAlertingConfig{
				Config: Config{
					Route: &config.Route{
						Receiver: "graf",
						Routes: []*config.Route{
							{
								Receiver: "graf",
							},
						},
					},
				},
				Receivers: []*PostableApiReceiver{
					{
						Receiver: config.Receiver{
							Name: "graf",
						},
						PostableGrafanaReceivers: PostableGrafanaReceivers{
							GrafanaManagedReceivers: []*PostableGrafanaReceiver{{}},
						},
					},
				},
			},
		},
		{
			desc: "failure undefined am receiver",
			input: PostableApiAlertingConfig{
				Config: Config{
					Route: &config.Route{
						Receiver: "am",
						Routes: []*config.Route{
							{
								Receiver: "unmentioned",
							},
						},
					},
				},
				Receivers: []*PostableApiReceiver{
					{
						Receiver: config.Receiver{
							Name:         "am",
							EmailConfigs: []*config.EmailConfig{{}},
						},
					},
				},
			},
			err: true,
		},
		{
			desc: "failure undefined graf receiver",
			input: PostableApiAlertingConfig{
				Config: Config{
					Route: &config.Route{
						Receiver: "graf",
						Routes: []*config.Route{
							{
								Receiver: "unmentioned",
							},
						},
					},
				},
				Receivers: []*PostableApiReceiver{
					{
						Receiver: config.Receiver{
							Name: "graf",
						},
						PostableGrafanaReceivers: PostableGrafanaReceivers{
							GrafanaManagedReceivers: []*PostableGrafanaReceiver{{}},
						},
					},
				},
			},
			err: true,
		},
		{
			desc: "failure graf no route",
			input: PostableApiAlertingConfig{
				Receivers: []*PostableApiReceiver{
					{
						Receiver: config.Receiver{
							Name: "graf",
						},
						PostableGrafanaReceivers: PostableGrafanaReceivers{
							GrafanaManagedReceivers: []*PostableGrafanaReceiver{{}},
						},
					},
				},
			},
			err: true,
		},
		{
			desc: "failure graf no default receiver",
			input: PostableApiAlertingConfig{
				Config: Config{
					Route: &config.Route{
						Routes: []*config.Route{
							{
								Receiver: "graf",
							},
						},
					},
				},
				Receivers: []*PostableApiReceiver{
					{
						Receiver: config.Receiver{
							Name: "graf",
						},
						PostableGrafanaReceivers: PostableGrafanaReceivers{
							GrafanaManagedReceivers: []*PostableGrafanaReceiver{{}},
						},
					},
				},
			},
			err: true,
		},
		{
			desc: "failure graf root route with matchers",
			input: PostableApiAlertingConfig{
				Config: Config{
					Route: &config.Route{
						Receiver: "graf",
						Routes: []*config.Route{
							{
								Receiver: "graf",
							},
						},
						Match: map[string]string{"foo": "bar"},
					},
				},
				Receivers: []*PostableApiReceiver{
					{
						Receiver: config.Receiver{
							Name: "graf",
						},
						PostableGrafanaReceivers: PostableGrafanaReceivers{
							GrafanaManagedReceivers: []*PostableGrafanaReceiver{{}},
						},
					},
				},
			},
			err: true,
		},
		{
			desc: "failure graf nested route duplicate group by labels",
			input: PostableApiAlertingConfig{
				Config: Config{
					Route: &config.Route{
						Receiver: "graf",
						Routes: []*config.Route{
							{
								Receiver:   "graf",
								GroupByStr: []string{"foo", "bar", "foo"},
							},
						},
					},
				},
				Receivers: []*PostableApiReceiver{
					{
						Receiver: config.Receiver{
							Name: "graf",
						},
						PostableGrafanaReceivers: PostableGrafanaReceivers{
							GrafanaManagedReceivers: []*PostableGrafanaReceiver{{}},
						},
					},
				},
			},
			err: true,
		},
	} {
		t.Run(tc.desc, func(t *testing.T) {
			encoded, err := json.Marshal(tc.input)
			require.Nil(t, err)

			var out PostableApiAlertingConfig
			err = json.Unmarshal(encoded, &out)

			if tc.err {
				require.Error(t, err)
			} else {
				require.Nil(t, err)
				require.Equal(t, tc.input, out)
			}
		})
	}
}

func Test_PostableApiReceiver_Unmarshaling_YAML(t *testing.T) {
	for _, tc := range []struct {
		desc  string
		input string
		rtype ReceiverType
	}{
		{
			desc: "grafana receivers",
			input: `
name: grafana_managed
grafana_managed_receiver_configs:
  - uid: alertmanager UID
    name: an alert manager receiver
    type: prometheus-alertmanager
    sendreminder: false
    disableresolvemessage: false
    frequency: 5m
    isdefault: false
    settings: {}
    securesettings:
      basicAuthPassword: <basicAuthPassword>
  - uid: dingding UID
    name: a dingding receiver
    type: dingding
    sendreminder: false
    disableresolvemessage: false
    frequency: 5m
    isdefault: false`,
			rtype: GrafanaReceiverType,
		},
		{
			desc: "receiver",
			input: `
name: example-email
email_configs:
  - to: 'youraddress@example.org'`,
			rtype: AlertmanagerReceiverType,
		},
	} {
		t.Run(tc.desc, func(t *testing.T) {
			var r PostableApiReceiver
			err := yaml.Unmarshal([]byte(tc.input), &r)
			require.Nil(t, err)
			assert.Equal(t, tc.rtype, r.Type())
		})
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
						Route: &config.Route{
							Receiver: "am",
							Routes: []*config.Route{
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
			// Override the map[string]interface{} field for test simplicity.
			// It's tested in Test_GettableUserConfigRoundtrip.
			out.amSimple = nil
			require.Equal(t, tc.output, out)
		})
	}
}

func Test_GettableUserConfigRoundtrip(t *testing.T) {
	// raw contains secret fields. We'll unmarshal, re-marshal, and ensure
	// the fields are not redacted.
	yamlEncoded, err := ioutil.ReadFile("alertmanager_test_artifact.yaml")
	require.Nil(t, err)

	jsonEncoded, err := ioutil.ReadFile("alertmanager_test_artifact.json")
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

func Test_ReceiverCompatibility(t *testing.T) {
	for _, tc := range []struct {
		desc     string
		a, b     ReceiverType
		expected bool
	}{
		{
			desc:     "grafana=grafana",
			a:        GrafanaReceiverType,
			b:        GrafanaReceiverType,
			expected: true,
		},
		{
			desc:     "am=am",
			a:        AlertmanagerReceiverType,
			b:        AlertmanagerReceiverType,
			expected: true,
		},
		{
			desc:     "empty=grafana",
			a:        EmptyReceiverType,
			b:        AlertmanagerReceiverType,
			expected: true,
		},
		{
			desc:     "empty=am",
			a:        EmptyReceiverType,
			b:        AlertmanagerReceiverType,
			expected: true,
		},
		{
			desc:     "empty=empty",
			a:        EmptyReceiverType,
			b:        EmptyReceiverType,
			expected: true,
		},
		{
			desc:     "graf!=am",
			a:        GrafanaReceiverType,
			b:        AlertmanagerReceiverType,
			expected: false,
		},
		{
			desc:     "am!=graf",
			a:        AlertmanagerReceiverType,
			b:        GrafanaReceiverType,
			expected: false,
		},
	} {
		t.Run(tc.desc, func(t *testing.T) {
			require.Equal(t, tc.expected, tc.a.Can(tc.b))
		})
	}
}

func Test_ReceiverMatchesBackend(t *testing.T) {
	for _, tc := range []struct {
		desc string
		rec  ReceiverType
		b    Backend
		err  bool
	}{
		{
			desc: "graf=graf",
			rec:  GrafanaReceiverType,
			b:    GrafanaBackend,
			err:  false,
		},
		{
			desc: "empty=graf",
			rec:  EmptyReceiverType,
			b:    GrafanaBackend,
			err:  false,
		},
		{
			desc: "am=am",
			rec:  AlertmanagerReceiverType,
			b:    AlertmanagerBackend,
			err:  false,
		},
		{
			desc: "empty=am",
			rec:  EmptyReceiverType,
			b:    AlertmanagerBackend,
			err:  false,
		},
		{
			desc: "graf!=am",
			rec:  GrafanaReceiverType,
			b:    AlertmanagerBackend,
			err:  true,
		},
		{
			desc: "am!=ruler",
			rec:  GrafanaReceiverType,
			b:    LoTexRulerBackend,
			err:  true,
		},
	} {
		t.Run(tc.desc, func(t *testing.T) {
			err := tc.rec.MatchesBackend(tc.b)
			if tc.err {
				require.NotNil(t, err)
			} else {
				require.Nil(t, err)
			}
		})
	}
}

func Test_Marshaling_Validation(t *testing.T) {
	jsonEncoded, err := ioutil.ReadFile("alertmanager_test_artifact.json")
	require.Nil(t, err)

	var tmp GettableUserConfig
	require.Nil(t, json.Unmarshal(jsonEncoded, &tmp))

	expected := []model.LabelName{"alertname"}
	require.Equal(t, expected, tmp.AlertmanagerConfig.Config.Route.GroupBy)
}
