package ngalert

import (
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func TestGetRuleDefaultIntervalSeconds(t *testing.T) {
	testCases := []struct {
		desc                string
		alertingMinInterval int64
		expOutput           int64
	}{
		{
			desc:                "negative min rule interval",
			alertingMinInterval: -1,
			expOutput:           defaultIntervalSeconds,
		},
		{
			desc:                "zero min rule interval",
			alertingMinInterval: 0,
			expOutput:           defaultIntervalSeconds,
		},
		{
			desc:                "invalid min rule interval",
			alertingMinInterval: 1,
			expOutput:           defaultIntervalSeconds,
		},
		{
			desc:                "valid min rule interval equals base scheduler interval",
			alertingMinInterval: defaultBaseIntervalSeconds,
			expOutput:           defaultIntervalSeconds,
		},
		{
			desc:                "valid min rule interval less than default",
			alertingMinInterval: defaultIntervalSeconds - defaultBaseIntervalSeconds,
			expOutput:           defaultIntervalSeconds,
		},
		{
			desc:                "valid min rule interval greater than default",
			alertingMinInterval: defaultIntervalSeconds + defaultBaseIntervalSeconds,
			expOutput:           defaultIntervalSeconds + defaultBaseIntervalSeconds,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			alertNG := AlertNG{
				Log: log.New("test"),
				Cfg: &setting.Cfg{
					AlertingMinInterval: tc.alertingMinInterval,
				},
			}
			require.Equal(t, tc.expOutput, alertNG.getRuleDefaultIntervalSeconds())
		})
	}
}

func TestGetRuleMinIntervalSeconds(t *testing.T) {
	testCases := []struct {
		desc                string
		alertingMinInterval int64
		expOutput           int64
	}{
		{
			desc:                "negative min rule interval",
			alertingMinInterval: -1,
			expOutput:           defaultBaseIntervalSeconds,
		},
		{
			desc:                "zero min rule interval",
			alertingMinInterval: 0,
			expOutput:           defaultBaseIntervalSeconds,
		},
		{
			desc:                "invalid min rule interval",
			alertingMinInterval: 1,
			expOutput:           defaultBaseIntervalSeconds,
		},
		{
			desc:                "valid min rule interval ",
			alertingMinInterval: defaultIntervalSeconds + defaultBaseIntervalSeconds,
			expOutput:           defaultIntervalSeconds + defaultBaseIntervalSeconds,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			alertNG := AlertNG{
				Log: log.New("test"),
				Cfg: &setting.Cfg{
					AlertingMinInterval: tc.alertingMinInterval,
				},
			}
			require.Equal(t, tc.expOutput, alertNG.getRuleMinIntervalSeconds())
		})
	}
}
