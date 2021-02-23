package validation

import (
	"testing"

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
