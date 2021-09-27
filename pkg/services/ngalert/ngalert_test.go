package ngalert

import (
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func TestGetRuleDefaultIntervalSeconds(t *testing.T) {
	testCases := []struct {
		desc                   string
		alertingMinIntervalCfg time.Duration
		// the expected default rule interval (applied if a rule interval is missing)
		expDefaultInterval time.Duration
		// the expected minimum rule interval (enforced if a rule interval is lower than this value; it is used also for computing the default rule interval)
		expMinInterval time.Duration
	}{
		{
			desc:                   "negative min rule interval",
			alertingMinIntervalCfg: -1,
			expDefaultInterval:     time.Duration(defaultIntervalSeconds) * time.Second, // 60s
			expMinInterval:         defaultBaseIntervalSeconds,                          // 10s
		},
		{
			desc:                   "zero min rule interval",
			alertingMinIntervalCfg: 0,
			expDefaultInterval:     time.Duration(defaultIntervalSeconds) * time.Second, // 60s
			expMinInterval:         defaultBaseIntervalSeconds,                          // 10s
		},
		{
			desc:                   "min rule interval not divided exactly by the scheduler interval",
			alertingMinIntervalCfg: 1,
			expDefaultInterval:     time.Duration(defaultIntervalSeconds) * time.Second, // 60s
			expMinInterval:         defaultBaseIntervalSeconds,                          // 10s
		},
		{
			desc:                   "min rule interval equals base scheduler interval",
			alertingMinIntervalCfg: defaultBaseIntervalSeconds,                          // 10s
			expDefaultInterval:     time.Duration(defaultIntervalSeconds) * time.Second, // 60s
			expMinInterval:         defaultBaseIntervalSeconds,                          // 10s
		},
		{
			desc:                   "valid min rule interval less than default rule interval",
			alertingMinIntervalCfg: time.Duration(defaultIntervalSeconds-defaultBaseIntervalSeconds) * time.Second, // 50s
			expDefaultInterval:     time.Duration(defaultIntervalSeconds) * time.Second,                            // 60s
			expMinInterval:         time.Duration(defaultIntervalSeconds-defaultBaseIntervalSeconds) * time.Second, // 50s
		},
		{
			desc:                   "valid min rule interval greater than default rule interval",
			alertingMinIntervalCfg: time.Duration(defaultIntervalSeconds+defaultBaseIntervalSeconds) * time.Second, // 70s
			expDefaultInterval:     time.Duration(defaultIntervalSeconds+defaultBaseIntervalSeconds) * time.Second, // 70s
			expMinInterval:         time.Duration(defaultIntervalSeconds+defaultBaseIntervalSeconds) * time.Second, // 70s
		},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			alertNG := AlertNG{
				Log: log.New("test"),
				Cfg: &setting.Cfg{
					UnifiedAlerting: setting.UnifiedAlertingSettings{
						MinInterval: tc.alertingMinIntervalCfg,
					},
				},
			}
			require.Equal(t, tc.expDefaultInterval, alertNG.getRuleDefaultInterval())
			require.Equal(t, tc.expMinInterval, alertNG.getRuleMinInterval())
		})
	}
}
