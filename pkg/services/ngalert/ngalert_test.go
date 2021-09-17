package ngalert

import (
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func TestGetRuleDefaultIntervalSeconds(t *testing.T) {
	testCases := []struct {
		desc                   string
		alertingMinIntervalCfg int64
		// the expected default rule interval (applied if a rule interval is missing)
		expDefaultIntervalSeconds int64
		// the expected minimum rule interval (enforced if a rule interval is lower than this value; it is used also for computing the default rule interval)
		expMinIntervalSeconds int64
	}{
		{
			desc:                      "negative min rule interval",
			alertingMinIntervalCfg:    -1,
			expDefaultIntervalSeconds: defaultIntervalSeconds,     // 60
			expMinIntervalSeconds:     defaultBaseIntervalSeconds, // 10
		},
		{
			desc:                      "zero min rule interval",
			alertingMinIntervalCfg:    0,
			expDefaultIntervalSeconds: defaultIntervalSeconds,     // 60
			expMinIntervalSeconds:     defaultBaseIntervalSeconds, // 10
		},
		{
			desc:                      "min rule interval not divided exactly by the scheduler interval",
			alertingMinIntervalCfg:    1,
			expDefaultIntervalSeconds: defaultIntervalSeconds,     // 60
			expMinIntervalSeconds:     defaultBaseIntervalSeconds, // 10
		},
		{
			desc:                      "min rule interval equals base scheduler interval",
			alertingMinIntervalCfg:    defaultBaseIntervalSeconds, // 10
			expDefaultIntervalSeconds: defaultIntervalSeconds,     // 60
			expMinIntervalSeconds:     defaultBaseIntervalSeconds, // 10
		},
		{
			desc:                      "valid min rule interval less than default rule interval",
			alertingMinIntervalCfg:    defaultIntervalSeconds - defaultBaseIntervalSeconds, // 50
			expDefaultIntervalSeconds: defaultIntervalSeconds,                              // 60
			expMinIntervalSeconds:     defaultIntervalSeconds - defaultBaseIntervalSeconds, // 50
		},
		{
			desc:                      "valid min rule interval greater than default rule interval",
			alertingMinIntervalCfg:    defaultIntervalSeconds + defaultBaseIntervalSeconds, // 70
			expDefaultIntervalSeconds: defaultIntervalSeconds + defaultBaseIntervalSeconds, // 70
			expMinIntervalSeconds:     defaultIntervalSeconds + defaultBaseIntervalSeconds, // 70
		},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			alertNG := AlertNG{
				Log: log.New("test"),
				Cfg: &setting.Cfg{
					UnifiedAlertingMinInterval: tc.alertingMinIntervalCfg,
				},
			}
			require.Equal(t, tc.expDefaultIntervalSeconds, alertNG.getRuleDefaultIntervalSeconds())
			require.Equal(t, tc.expMinIntervalSeconds, alertNG.getRuleMinIntervalSeconds())

		})
	}
}
