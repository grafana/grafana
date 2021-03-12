package api

import (
	"encoding/json"
	"testing"

	"github.com/prometheus/alertmanager/config"
	"github.com/stretchr/testify/require"
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
				Config: config.Config{
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
				Config: config.Config{
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
				Config: config.Config{
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
				Config: config.Config{
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
