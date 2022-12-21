package definitions

import (
	"encoding/json"
	"errors"
	"os"
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
	input := &Route{
		Receiver: "foo",
		Routes: []*Route{
			{
				Receiver: "bar",
				Routes: []*Route{
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

	require.Equal(t, []string{"foo", "bar", "bazz", "buzz"}, AllReceivers(input.AsAMRoute()))

	// test empty
	var empty []string
	emptyRoute := &Route{}
	require.Equal(t, empty, AllReceivers(emptyRoute.AsAMRoute()))
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
					Route: &Route{
						Receiver: "am",
						Routes: []*Route{
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
					Route: &Route{
						Receiver: "graf",
						Routes: []*Route{
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
					Route: &Route{
						Receiver: "am",
						Routes: []*Route{
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
					Route: &Route{
						Receiver: "graf",
						Routes: []*Route{
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
					Route: &Route{
						Routes: []*Route{
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
					Route: &Route{
						Receiver: "graf",
						Routes: []*Route{
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
					Route: &Route{
						Receiver: "graf",
						Routes: []*Route{
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

func Test_ConfigUnmashaling(t *testing.T) {
	for _, tc := range []struct {
		desc, input string
		err         error
	}{
		{
			desc: "empty mute time name should error",
			err:  errors.New("missing name in mute time interval"),
			input: `
				{
				  "route": {
					"receiver": "grafana-default-email"
				  },
				  "mute_time_intervals": [
					{
					  "name": "",
					  "time_intervals": [
						{
						  "times": [
							{
							  "start_time": "00:00",
							  "end_time": "12:00"
							}
						  ]
						}
					  ]
					}
				  ],
				  "templates": null,
				  "receivers": [
					{
					  "name": "grafana-default-email",
					  "grafana_managed_receiver_configs": [
						{
						  "uid": "uxwfZvtnz",
						  "name": "email receiver",
						  "type": "email",
						  "disableResolveMessage": false,
						  "settings": {
							"addresses": "<example@email.com>"
						  },
						  "secureFields": {}
						}
					  ]
					}
				  ]
				}
			`,
		},
		{
			desc: "not unique mute time names should error",
			err:  errors.New("mute time interval \"test1\" is not unique"),
			input: `
				{
				  "route": {
					"receiver": "grafana-default-email"
				  },
				  "mute_time_intervals": [
					{
					  "name": "test1",
					  "time_intervals": [
						{
						  "times": [
							{
							  "start_time": "00:00",
							  "end_time": "12:00"
							}
						  ]
						}
					  ]
					},
					{
						"name": "test1",
						"time_intervals": [
						  {
							"times": [
							  {
								"start_time": "00:00",
								"end_time": "12:00"
							  }
							]
						  }
						]
					  }
				  ],
				  "templates": null,
				  "receivers": [
					{
					  "name": "grafana-default-email",
					  "grafana_managed_receiver_configs": [
						{
						  "uid": "uxwfZvtnz",
						  "name": "email receiver",
						  "type": "email",
						  "disableResolveMessage": false,
						  "settings": {
							"addresses": "<example@email.com>"
						  },
						  "secureFields": {}
						}
					  ]
					}
				  ]
				}
			`,
		},
		{
			desc: "mute time intervals on root route should error",
			err:  errors.New("root route must not have any mute time intervals"),
			input: `
				{
				  "route": {
					"receiver": "grafana-default-email",
					"mute_time_intervals": ["test1"]
				  },
				  "mute_time_intervals": [
					{
					  "name": "test1",
					  "time_intervals": [
						{
						  "times": [
							{
							  "start_time": "00:00",
							  "end_time": "12:00"
							}
						  ]
						}
					  ]
					}
				  ],
				  "templates": null,
				  "receivers": [
					{
					  "name": "grafana-default-email",
					  "grafana_managed_receiver_configs": [
						{
						  "uid": "uxwfZvtnz",
						  "name": "email receiver",
						  "type": "email",
						  "disableResolveMessage": false,
						  "settings": {
							"addresses": "<example@email.com>"
						  },
						  "secureFields": {}
						}
					  ]
					}
				  ]
				}
			`,
		},
		{
			desc: "undefined mute time names in routes should error",
			err:  errors.New("undefined time interval \"test2\" used in route"),
			input: `
				{
				  "route": {
					"receiver": "grafana-default-email",
					"routes": [
						{
						  "receiver": "grafana-default-email",
						  "object_matchers": [
							[
							  "a",
							  "=",
							  "b"
							]
						  ],
						  "mute_time_intervals": [
							"test2"
						  ]
						}
					  ]
				  },
				  "mute_time_intervals": [
					{
					  "name": "test1",
					  "time_intervals": [
						{
						  "times": [
							{
							  "start_time": "00:00",
							  "end_time": "12:00"
							}
						  ]
						}
					  ]
					}
				  ],
				  "templates": null,
				  "receivers": [
					{
					  "name": "grafana-default-email",
					  "grafana_managed_receiver_configs": [
						{
						  "uid": "uxwfZvtnz",
						  "name": "email receiver",
						  "type": "email",
						  "disableResolveMessage": false,
						  "settings": {
							"addresses": "<example@email.com>"
						  },
						  "secureFields": {}
						}
					  ]
					}
				  ]
				}
			`,
		},
		{
			desc: "valid config should not error",
			input: `
				{
				  "route": {
					"receiver": "grafana-default-email",
					"routes": [
						{
						  "receiver": "grafana-default-email",
						  "object_matchers": [
							[
							  "a",
							  "=",
							  "b"
							]
						  ],
						  "mute_time_intervals": [
							"test1"
						  ]
						}
					  ]
				  },
				  "mute_time_intervals": [
					{
					  "name": "test1",
					  "time_intervals": [
						{
						  "times": [
							{
							  "start_time": "00:00",
							  "end_time": "12:00"
							}
						  ]
						}
					  ]
					}
				  ],
				  "templates": null,
				  "receivers": [
					{
					  "name": "grafana-default-email",
					  "grafana_managed_receiver_configs": [
						{
						  "uid": "uxwfZvtnz",
						  "name": "email receiver",
						  "type": "email",
						  "disableResolveMessage": false,
						  "settings": {
							"addresses": "<example@email.com>"
						  },
						  "secureFields": {}
						}
					  ]
					}
				  ]
				}
			`,
		},
	} {
		t.Run(tc.desc, func(t *testing.T) {
			var out Config
			err := json.Unmarshal([]byte(tc.input), &out)
			require.Equal(t, tc.err, err)
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
		b    ReceiverType
		ok   bool
	}{
		{
			desc: "graf=graf",
			rec:  GrafanaReceiverType,
			b:    GrafanaReceiverType,
			ok:   true,
		},
		{
			desc: "empty=graf",
			rec:  EmptyReceiverType,
			b:    GrafanaReceiverType,
			ok:   true,
		},
		{
			desc: "am=am",
			rec:  AlertmanagerReceiverType,
			b:    AlertmanagerReceiverType,
			ok:   true,
		},
		{
			desc: "empty=am",
			rec:  EmptyReceiverType,
			b:    AlertmanagerReceiverType,
			ok:   true,
		},
		{
			desc: "graf!=am",
			rec:  GrafanaReceiverType,
			b:    AlertmanagerReceiverType,
			ok:   false,
		},
	} {
		t.Run(tc.desc, func(t *testing.T) {
			ok := tc.rec.Can(tc.b)
			require.Equal(t, tc.ok, ok)
		})
	}
}

func TestObjectMatchers_UnmarshalJSON(t *testing.T) {
	j := `{
		"receiver": "autogen-contact-point-default",
		"routes": [{
			"receiver": "autogen-contact-point-1",
			"object_matchers": [
				[
					"a",
					"=",
					"MFR3Gxrnk"
				],
				[
					"b",
					"=",
					"\"MFR3Gxrnk\""
				],
				[
					"c",
					"=~",
					"^[a-z0-9-]{1}[a-z0-9-]{0,30}$"
				],
				[
					"d",
					"=~",
					"\"^[a-z0-9-]{1}[a-z0-9-]{0,30}$\""
				]
			],
			"group_interval": "3s",
			"repeat_interval": "10s"
		}]
}`
	var r Route
	if err := json.Unmarshal([]byte(j), &r); err != nil {
		require.NoError(t, err)
	}

	matchers := r.Routes[0].ObjectMatchers

	// Without quotes.
	require.Equal(t, matchers[0].Name, "a")
	require.Equal(t, matchers[0].Value, "MFR3Gxrnk")

	// With double quotes.
	require.Equal(t, matchers[1].Name, "b")
	require.Equal(t, matchers[1].Value, "MFR3Gxrnk")

	// Regexp without quotes.
	require.Equal(t, matchers[2].Name, "c")
	require.Equal(t, matchers[2].Value, "^[a-z0-9-]{1}[a-z0-9-]{0,30}$")

	// Regexp with quotes.
	require.Equal(t, matchers[3].Name, "d")
	require.Equal(t, matchers[3].Value, "^[a-z0-9-]{1}[a-z0-9-]{0,30}$")
}

func TestObjectMatchers_UnmarshalYAML(t *testing.T) {
	y := `---
receiver: autogen-contact-point-default
routes:
- receiver: autogen-contact-point-1
  object_matchers:
  - - a
    - "="
    - MFR3Gxrnk
  - - b
    - "="
    - '"MFR3Gxrnk"'
  - - c
    - "=~"
    - "^[a-z0-9-]{1}[a-z0-9-]{0,30}$"
  - - d
    - "=~"
    - '"^[a-z0-9-]{1}[a-z0-9-]{0,30}$"'
  group_interval: 3s
  repeat_interval: 10s
`

	var r Route
	if err := yaml.Unmarshal([]byte(y), &r); err != nil {
		require.NoError(t, err)
	}

	matchers := r.Routes[0].ObjectMatchers

	// Without quotes.
	require.Equal(t, matchers[0].Name, "a")
	require.Equal(t, matchers[0].Value, "MFR3Gxrnk")

	// With double quotes.
	require.Equal(t, matchers[1].Name, "b")
	require.Equal(t, matchers[1].Value, "MFR3Gxrnk")

	// Regexp without quotes.
	require.Equal(t, matchers[2].Name, "c")
	require.Equal(t, matchers[2].Value, "^[a-z0-9-]{1}[a-z0-9-]{0,30}$")

	// Regexp with quotes.
	require.Equal(t, matchers[3].Name, "d")
	require.Equal(t, matchers[3].Value, "^[a-z0-9-]{1}[a-z0-9-]{0,30}$")
}

func Test_Marshaling_Validation(t *testing.T) {
	jsonEncoded, err := os.ReadFile("alertmanager_test_artifact.json")
	require.Nil(t, err)

	var tmp GettableUserConfig
	require.Nil(t, json.Unmarshal(jsonEncoded, &tmp))

	expected := []model.LabelName{"alertname"}
	require.Equal(t, expected, tmp.AlertmanagerConfig.Config.Route.GroupBy)
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
