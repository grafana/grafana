package notifier

import (
	"context"
	"errors"
	"sort"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/secrets/database"

	"github.com/go-openapi/strfmt"
	"github.com/prometheus/alertmanager/api/v2/models"
	"github.com/prometheus/alertmanager/provider/mem"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	secretsManager "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/setting"
)

func setupAMTest(t *testing.T) *Alertmanager {
	dir := t.TempDir()
	cfg := &setting.Cfg{
		DataPath: dir,
	}

	m := metrics.NewAlertmanagerMetrics(prometheus.NewRegistry())
	sqlStore := db.InitTestDB(t)
	s := &store.DBstore{
		Cfg: setting.UnifiedAlertingSettings{
			BaseInterval:                  10 * time.Second,
			DefaultRuleEvaluationInterval: time.Minute,
		},
		SQLStore:         sqlStore,
		Logger:           log.New("alertmanager-test"),
		DashboardService: dashboards.NewFakeDashboardService(t),
	}

	kvStore := NewFakeKVStore(t)
	secretsService := secretsManager.SetupTestService(t, database.ProvideSecretsStore(sqlStore))
	decryptFn := secretsService.GetDecryptedValue
	am, err := newAlertmanager(context.Background(), 1, cfg, s, kvStore, &NilPeer{}, decryptFn, nil, m)
	require.NoError(t, err)
	return am
}

func TestPutAlert(t *testing.T) {
	am := setupAMTest(t)

	startTime := time.Now()
	endTime := startTime.Add(2 * time.Hour)

	cases := []struct {
		title          string
		postableAlerts apimodels.PostableAlerts
		expAlerts      func(now time.Time) []*types.Alert
		expError       *AlertValidationError
	}{
		{
			title: "Valid alerts with different start/end set",
			postableAlerts: apimodels.PostableAlerts{
				PostableAlerts: []models.PostableAlert{
					{ // Start and end set.
						Annotations: models.LabelSet{"msg": "Alert1 annotation"},
						Alert: models.Alert{
							Labels:       models.LabelSet{"alertname": "Alert1"},
							GeneratorURL: "http://localhost/url1",
						},
						StartsAt: strfmt.DateTime(startTime),
						EndsAt:   strfmt.DateTime(endTime),
					}, { // Only end is set.
						Annotations: models.LabelSet{"msg": "Alert2 annotation"},
						Alert: models.Alert{
							Labels:       models.LabelSet{"alertname": "Alert2"},
							GeneratorURL: "http://localhost/url2",
						},
						StartsAt: strfmt.DateTime{},
						EndsAt:   strfmt.DateTime(endTime),
					}, { // Only start is set.
						Annotations: models.LabelSet{"msg": "Alert3 annotation"},
						Alert: models.Alert{
							Labels:       models.LabelSet{"alertname": "Alert3"},
							GeneratorURL: "http://localhost/url3",
						},
						StartsAt: strfmt.DateTime(startTime),
						EndsAt:   strfmt.DateTime{},
					}, { // Both start and end are not set.
						Annotations: models.LabelSet{"msg": "Alert4 annotation"},
						Alert: models.Alert{
							Labels:       models.LabelSet{"alertname": "Alert4"},
							GeneratorURL: "http://localhost/url4",
						},
						StartsAt: strfmt.DateTime{},
						EndsAt:   strfmt.DateTime{},
					},
				},
			},
			expAlerts: func(now time.Time) []*types.Alert {
				return []*types.Alert{
					{
						Alert: model.Alert{
							Annotations:  model.LabelSet{"msg": "Alert1 annotation"},
							Labels:       model.LabelSet{"alertname": "Alert1"},
							StartsAt:     startTime,
							EndsAt:       endTime,
							GeneratorURL: "http://localhost/url1",
						},
						UpdatedAt: now,
					}, {
						Alert: model.Alert{
							Annotations:  model.LabelSet{"msg": "Alert2 annotation"},
							Labels:       model.LabelSet{"alertname": "Alert2"},
							StartsAt:     endTime,
							EndsAt:       endTime,
							GeneratorURL: "http://localhost/url2",
						},
						UpdatedAt: now,
					}, {
						Alert: model.Alert{
							Annotations:  model.LabelSet{"msg": "Alert3 annotation"},
							Labels:       model.LabelSet{"alertname": "Alert3"},
							StartsAt:     startTime,
							EndsAt:       now.Add(defaultResolveTimeout),
							GeneratorURL: "http://localhost/url3",
						},
						UpdatedAt: now,
						Timeout:   true,
					}, {
						Alert: model.Alert{
							Annotations:  model.LabelSet{"msg": "Alert4 annotation"},
							Labels:       model.LabelSet{"alertname": "Alert4"},
							StartsAt:     now,
							EndsAt:       now.Add(defaultResolveTimeout),
							GeneratorURL: "http://localhost/url4",
						},
						UpdatedAt: now,
						Timeout:   true,
					},
				}
			},
		}, {
			title: "Removing empty labels and annotations",
			postableAlerts: apimodels.PostableAlerts{
				PostableAlerts: []models.PostableAlert{
					{
						Annotations: models.LabelSet{"msg": "Alert4 annotation", "empty": ""},
						Alert: models.Alert{
							Labels:       models.LabelSet{"alertname": "Alert4", "emptylabel": ""},
							GeneratorURL: "http://localhost/url1",
						},
						StartsAt: strfmt.DateTime{},
						EndsAt:   strfmt.DateTime{},
					},
				},
			},
			expAlerts: func(now time.Time) []*types.Alert {
				return []*types.Alert{
					{
						Alert: model.Alert{
							Annotations:  model.LabelSet{"msg": "Alert4 annotation"},
							Labels:       model.LabelSet{"alertname": "Alert4"},
							StartsAt:     now,
							EndsAt:       now.Add(defaultResolveTimeout),
							GeneratorURL: "http://localhost/url1",
						},
						UpdatedAt: now,
						Timeout:   true,
					},
				}
			},
		}, {
			title: "Allow spaces in label and annotation name",
			postableAlerts: apimodels.PostableAlerts{
				PostableAlerts: []models.PostableAlert{
					{
						Annotations: models.LabelSet{"Dashboard URL": "http://localhost:3000"},
						Alert: models.Alert{
							Labels:       models.LabelSet{"alertname": "Alert4", "Spaced Label": "works"},
							GeneratorURL: "http://localhost/url1",
						},
						StartsAt: strfmt.DateTime{},
						EndsAt:   strfmt.DateTime{},
					},
				},
			},
			expAlerts: func(now time.Time) []*types.Alert {
				return []*types.Alert{
					{
						Alert: model.Alert{
							Annotations:  model.LabelSet{"Dashboard URL": "http://localhost:3000"},
							Labels:       model.LabelSet{"alertname": "Alert4", "Spaced Label": "works"},
							StartsAt:     now,
							EndsAt:       now.Add(defaultResolveTimeout),
							GeneratorURL: "http://localhost/url1",
						},
						UpdatedAt: now,
						Timeout:   true,
					},
				}
			},
		}, {
			title: "Special characters in labels",
			postableAlerts: apimodels.PostableAlerts{
				PostableAlerts: []models.PostableAlert{
					{
						Alert: models.Alert{
							Labels: models.LabelSet{"alertname$": "Alert1", "az3-- __...++!!!£@@312312": "1"},
						},
					},
				},
			},
			expAlerts: func(now time.Time) []*types.Alert {
				return []*types.Alert{
					{
						Alert: model.Alert{
							Labels:       model.LabelSet{"alertname$": "Alert1", "az3-- __...++!!!£@@312312": "1"},
							Annotations:  model.LabelSet{},
							StartsAt:     now,
							EndsAt:       now.Add(defaultResolveTimeout),
							GeneratorURL: "",
						},
						UpdatedAt: now,
						Timeout:   true,
					},
				}
			},
		}, {
			title: "Special characters in annotations",
			postableAlerts: apimodels.PostableAlerts{
				PostableAlerts: []models.PostableAlert{
					{
						Annotations: models.LabelSet{"az3-- __...++!!!£@@312312": "Alert4 annotation"},
						Alert: models.Alert{
							Labels: models.LabelSet{"alertname": "Alert4"},
						},
					},
				},
			},
			expAlerts: func(now time.Time) []*types.Alert {
				return []*types.Alert{
					{
						Alert: model.Alert{
							Labels:       model.LabelSet{"alertname": "Alert4"},
							Annotations:  model.LabelSet{"az3-- __...++!!!£@@312312": "Alert4 annotation"},
							StartsAt:     now,
							EndsAt:       now.Add(defaultResolveTimeout),
							GeneratorURL: "",
						},
						UpdatedAt: now,
						Timeout:   true,
					},
				}
			},
		}, {
			title: "No labels after removing empty",
			postableAlerts: apimodels.PostableAlerts{
				PostableAlerts: []models.PostableAlert{
					{
						Alert: models.Alert{
							Labels: models.LabelSet{"alertname": ""},
						},
					},
				},
			},
			expError: &AlertValidationError{
				Alerts: []models.PostableAlert{
					{
						Alert: models.Alert{
							Labels: models.LabelSet{"alertname": ""},
						},
					},
				},
				Errors: []error{errors.New("at least one label pair required")},
			},
		}, {
			title: "Start should be before end",
			postableAlerts: apimodels.PostableAlerts{
				PostableAlerts: []models.PostableAlert{
					{
						Alert: models.Alert{
							Labels: models.LabelSet{"alertname": ""},
						},
						StartsAt: strfmt.DateTime(endTime),
						EndsAt:   strfmt.DateTime(startTime),
					},
				},
			},
			expError: &AlertValidationError{
				Alerts: []models.PostableAlert{
					{
						Alert: models.Alert{
							Labels: models.LabelSet{"alertname": ""},
						},
						StartsAt: strfmt.DateTime(endTime),
						EndsAt:   strfmt.DateTime(startTime),
					},
				},
				Errors: []error{errors.New("start time must be before end time")},
			},
		},
	}

	for _, c := range cases {
		var err error
		t.Run(c.title, func(t *testing.T) {
			r := prometheus.NewRegistry()
			am.marker = types.NewMarker(r)
			am.alerts, err = mem.NewAlerts(context.Background(), am.marker, 15*time.Minute, nil, am.logger, r)
			require.NoError(t, err)

			alerts := []*types.Alert{}
			err := am.PutAlerts(c.postableAlerts)
			if c.expError != nil {
				require.Error(t, err)
				require.Equal(t, c.expError, err)
				require.Equal(t, 0, len(alerts))
				return
			}
			require.NoError(t, err)

			iter := am.alerts.GetPending()
			defer iter.Close()
			for a := range iter.Next() {
				alerts = append(alerts, a)
			}

			// We take the "now" time from one of the UpdatedAt.
			now := alerts[0].UpdatedAt
			expAlerts := c.expAlerts(now)

			sort.Sort(types.AlertSlice(expAlerts))
			sort.Sort(types.AlertSlice(alerts))

			require.Equal(t, expAlerts, alerts)
		})
	}
}

// Tests cleanup of expired Silences. We rely on prometheus/alertmanager for
// our alert silencing functionality, so we rely on its tests. However, we
// implement a custom maintenance function for silences, because we snapshot
// our data differently, so we test that functionality.
func TestSilenceCleanup(t *testing.T) {
	require := require.New(t)

	oldRetention := retentionNotificationsAndSilences
	retentionNotificationsAndSilences = 30 * time.Millisecond
	oldMaintenance := silenceMaintenanceInterval
	silenceMaintenanceInterval = 15 * time.Millisecond
	t.Cleanup(
		func() {
			retentionNotificationsAndSilences = oldRetention
			silenceMaintenanceInterval = oldMaintenance
		})

	am := setupAMTest(t)
	now := time.Now()
	dt := func(t time.Time) strfmt.DateTime { return strfmt.DateTime(t) }

	makeSilence := func(comment string, createdBy string,
		startsAt, endsAt strfmt.DateTime, matchers models.Matchers) *apimodels.PostableSilence {
		return &apimodels.PostableSilence{
			ID: "",
			Silence: models.Silence{
				Comment:   &comment,
				CreatedBy: &createdBy,
				StartsAt:  &startsAt,
				EndsAt:    &endsAt,
				Matchers:  matchers,
			},
		}
	}

	tru := true
	testString := "testName"
	matchers := models.Matchers{&models.Matcher{Name: &testString, IsEqual: &tru, IsRegex: &tru, Value: &testString}}
	// Create silences - one in the future, one currently active, one expired but
	// retained, one expired and not retained.
	silences := []*apimodels.PostableSilence{
		// Active in future
		makeSilence("", "tests", dt(now.Add(5*time.Hour)), dt(now.Add(6*time.Hour)), matchers),
		// Active now
		makeSilence("", "tests", dt(now.Add(-5*time.Hour)), dt(now.Add(6*time.Hour)), matchers),
		// Expiring soon.
		makeSilence("", "tests", dt(now.Add(-5*time.Hour)), dt(now.Add(5*time.Second)), matchers),
		// Expiring *very* soon
		makeSilence("", "tests", dt(now.Add(-5*time.Hour)), dt(now.Add(2*time.Second)), matchers),
	}

	for _, s := range silences {
		_, err := am.CreateSilence(s)
		require.NoError(err)
	}

	// Let enough time pass for the maintenance window to run.
	require.Eventually(func() bool {
		// So, what silences do we have now?
		found, err := am.ListSilences(nil)
		require.NoError(err)
		return len(found) == 3
	}, 3*time.Second, 150*time.Millisecond)

	// Wait again for another silence to expire.
	require.Eventually(func() bool {
		found, err := am.ListSilences(nil)
		require.NoError(err)
		return len(found) == 2
	}, 6*time.Second, 150*time.Millisecond)
}
