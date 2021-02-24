package validation

import (
	"testing"

	"github.com/grafana/alerting-api/pkg/api"
	"github.com/prometheus/alertmanager/config"
	"github.com/stretchr/testify/require"
)

func Test_allReceivers(t *testing.T) {
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

	require.Equal(t, []string{"foo", "bar", "bazz", "buzz"}, allReceivers(input))
}

func Test_Splitroutes(t *testing.T) {
	receivers := map[string]api.ReceiverType{
		"am":   api.AlertmanagerReceiverType,
		"graf": api.GrafanaReceiverType,
	}

	for _, tc := range []struct {
		desc              string
		input             []*config.Route
		receivers         map[string]api.ReceiverType
		err               bool
		gRoutes, amRoutes []*config.Route
	}{
		{
			desc: "splits simple",
			input: []*config.Route{
				{
					Receiver: "am",
				},
				{
					Receiver: "graf",
				},
			},
			err: false,
			gRoutes: []*config.Route{
				{
					Receiver: "graf",
				},
			},
			amRoutes: []*config.Route{
				{
					Receiver: "am",
				},
			},
		},
		{
			desc: "splits nested",
			input: []*config.Route{
				{
					Receiver: "am",
					Routes: []*config.Route{
						{
							Receiver: "am",
						},
					},
				},
				{
					Receiver: "graf",
					Routes: []*config.Route{
						{
							Receiver: "graf",
						},
					},
				},
			},
			err: false,
			gRoutes: []*config.Route{
				{
					Receiver: "graf",
					Routes: []*config.Route{
						{
							Receiver: "graf",
						},
					},
				},
			},
			amRoutes: []*config.Route{
				{
					Receiver: "am",
					Routes: []*config.Route{
						{
							Receiver: "am",
						},
					},
				},
			},
		},
		{
			desc: "errors undefined receiver",
			input: []*config.Route{
				{
					Receiver: "am",
					Routes: []*config.Route{
						{
							Receiver: "unmentioned",
						},
					},
				},
			},
			err: true,
		},
		{
			desc: "errors mixed",
			input: []*config.Route{
				{
					Receiver: "am",
					Routes: []*config.Route{
						{
							Receiver: "graf",
						},
					},
				},
				{
					Receiver: "graf",
					Routes: []*config.Route{
						{
							Receiver: "graf",
						},
					},
				},
			},
			err: true,
		},
	} {
		t.Run(tc.desc, func(t *testing.T) {
			gRoutes, amRoutes, err := SplitRoutes(tc.input, receivers)
			if tc.err {
				require.Error(t, err)
			} else {
				require.Equal(t, tc.gRoutes, gRoutes)
				require.Equal(t, tc.amRoutes, amRoutes)
			}
		})
	}
}
