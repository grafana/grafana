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
		input ApiReceiver
		err   bool
	}{
		{
			desc: "success AM",
			input: ApiReceiver{
				Receiver: config.Receiver{
					Name:         "foo",
					EmailConfigs: []*config.EmailConfig{{}},
				},
			},
		},
		{
			desc: "success GM",
			input: ApiReceiver{
				Receiver: config.Receiver{
					Name: "foo",
				},
				GrafanaReceivers: GrafanaReceivers{
					GrafanaManagedReceivers: []*GrafanaReceiver{{}},
				},
			},
		},
		{
			desc: "failure mixed",
			input: ApiReceiver{
				Receiver: config.Receiver{
					Name:         "foo",
					EmailConfigs: []*config.EmailConfig{{}},
				},
				GrafanaReceivers: GrafanaReceivers{
					GrafanaManagedReceivers: []*GrafanaReceiver{{}},
				},
			},
			err: true,
		},
	} {
		t.Run(tc.desc, func(t *testing.T) {
			encoded, err := json.Marshal(tc.input)
			require.Nil(t, err)

			var out ApiReceiver
			err = json.Unmarshal(encoded, &out)

			if tc.err {
				require.Error(t, err)
			} else {
				require.Equal(t, tc.input, out)
			}
		})
	}
}
