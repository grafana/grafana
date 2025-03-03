package alertmanager

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestAlertmanager_ExtraDedupStage(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	t.Run("assert no flapping alerts when stopOnExtraDedup is enabled", func(t *testing.T) {
		s, err := NewAlertmanagerScenario()
		require.NoError(t, err)
		defer s.Close()

		s.Start(t, 20, "15s", true)
		s.Provision(t, ProvisionCfg{
			AlertRuleConfig: AlertRuleConfig{
				PendingPeriod:                  "30s",
				GroupEvaluationIntervalSeconds: 10,
			},
			NotificationPolicyCfg: NotificationPolicyCfg{
				GroupWait:      "30s",
				GroupInterval:  "1m",
				RepeatInterval: "30m",
			},
		})

		wc, err := s.NewWebhookClient()
		require.NoError(t, err)

		lc, err := s.NewLokiClient()
		require.NoError(t, err)

		// notifications only start arriving after 2 to 3 minutes so we wait for that
		time.Sleep(time.Minute * 2)

		timeout := time.After(5 * time.Minute)
		ticker := time.NewTicker(5 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				nr, err := wc.GetNotifications()
				if err != nil {
					t.Logf("failed to get alert notifications: %v\n", err)
					continue
				}

				// get the latest state for the alert from loki
				st, err := lc.GetCurrentAlertState()
				if err != nil {
					t.Logf("failed to get alert state: %v\n", err)
					continue
				}

				// if the last state is not normal, ignore
				// we might be missing other cases of flapping notifications but for now we are only interested in this one
				// (alerting notification when state is already normal)
				if st.State != AlertStateNormal {
					continue
				}

				// history is ordered - fetch the first notification that is after the last state change
				var i int
				for i = range nr.History {
					if nr.History[i].TimeNow.After(st.Timestamp) {
						break
					}
				}

				// if all notifications are from before the last state change, we can wait a bit more
				if nr.History[i].TimeNow.Before(st.Timestamp) {
					continue
				}

				// for all notifications after the last state change, check if there is a firing one
				for ; i < len(nr.History); i++ {
					notification := nr.History[i]
					if notification.Status == "firing" {
						t.Errorf("flapping notifications - got firing notification when alert was resolved, state = %#v, notification = %#v", st, notification)
						t.FailNow()
					}
				}

			case <-timeout:
				// if after the timeout there are no such cases, we assume there are no flapping notifications
				return
			}
		}
	})
}
