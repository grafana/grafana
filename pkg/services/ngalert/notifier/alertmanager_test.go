package notifier

import (
	"context"
	"errors"
	"fmt"
	"io/ioutil"
	"math"
	"math/rand"
	"os"
	"sort"
	"strconv"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/util"

	ngModels "github.com/grafana/grafana/pkg/services/ngalert/models"

	"github.com/grafana/grafana/pkg/infra/log"

	gokit_log "github.com/go-kit/kit/log"
	"github.com/go-openapi/strfmt"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/logging"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/alertmanager/api/v2/models"
	"github.com/prometheus/alertmanager/provider/mem"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"
)

func setupAMTest(t *testing.T) *Alertmanager {
	dir, err := ioutil.TempDir("", "")
	require.NoError(t, err)
	t.Cleanup(func() {
		require.NoError(t, os.RemoveAll(dir))
	})
	cfg := &setting.Cfg{
		DataPath: dir,
	}

	m := metrics.NewAlertmanagerMetrics(prometheus.NewRegistry())
	sqlStore := sqlstore.InitTestDB(t)
	s := &store.DBstore{
		BaseInterval:    10 * time.Second,
		DefaultInterval: 60 * time.Second,
		SQLStore:        sqlStore,
		Logger:          log.New("alertmanager-test"),
	}

	kvStore := newFakeKVStore(t)
	am, err := newAlertmanager(1, cfg, s, kvStore, &NilPeer{}, m)
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
			am.alerts, err = mem.NewAlerts(context.Background(), am.marker, 15*time.Minute, nil, gokit_log.NewLogfmtLogger(logging.NewWrapper(am.logger)))
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

func TestStopAlertsForRules(t *testing.T) {
	seed := time.Now().UnixNano()
	t.Logf("Random seed is %d", seed)
	rand.Seed(seed)

	am := setupAMTest(t)
	r := prometheus.NewRegistry()
	am.marker = types.NewMarker(r)
	var err error
	am.alerts, err = mem.NewAlerts(context.Background(), am.marker, 15*time.Minute, nil, gokit_log.NewLogfmtLogger(logging.NewWrapper(am.logger)))
	require.NoError(t, err)
	// startTime := time.Now()
	// endTime := startTime.Add(2 * time.Hour)

	t.Run("should do nothing if no active alerts", func(t *testing.T) {
		toDelete := map[string]struct{}{
			util.GenerateShortUID(): {},
			util.GenerateShortUID(): {},
		}

		err := am.StopAlertsForRules(toDelete)
		require.NoError(t, err)
	})
	t.Run("should do nothing if no alerts to stop", func(t *testing.T) {
		toDelete := make(map[string]struct{})
		err := am.StopAlertsForRules(toDelete)
		require.NoError(t, err)

		err = am.StopAlertsForRules(nil)
		require.NoError(t, err)
	})
	t.Run("should set EndsAt for alert", func(t *testing.T) {
		alerts := make([]models.PostableAlert, 0, rand.Intn(4)+1)
		ruleIds := make(map[string]struct{}, cap(alerts))
		for i := 0; i < cap(alerts); i++ {
			ruleId := util.GenerateShortUID()
			ruleIds[ruleId] = struct{}{}
			alert := generatePostableAlert()
			alert.EndsAt = strfmt.DateTime(time.Now().Add(time.Duration(rand.Intn(120)+5) * time.Second))
			alert.Labels[ngModels.RuleUIDLabel] = ruleId
		}
		err = am.PutAlerts(apimodels.PostableAlerts{PostableAlerts: alerts})
		require.NoError(t, err)

		err = am.StopAlertsForRules(ruleIds)
		require.NoError(t, err)

		err = am.iterateAlerts(func(f *types.Alert) {
			ID, ok := f.Labels[ngModels.RuleUIDLabel]
			if !ok {
				return
			}
			_, ok = ruleIds[string(ID)]
			if !ok {
				return
			}
			require.True(t, f.EndsAt.Before(time.Now()), "Alert's EndAt is supposed to be in the past")
		})
		require.NoError(t, err)
	})
	t.Run("should not update alert that is already expired", func(t *testing.T) {
		alerts := make([]models.PostableAlert, 0, rand.Intn(4)+1)
		ruleIds := make(map[string]struct{}, cap(alerts))
		expectedTime := time.Now().Add(-time.Duration(rand.Intn(120)+1) * time.Second)
		for i := 0; i < cap(alerts); i++ {
			ruleId := util.GenerateShortUID()
			ruleIds[ruleId] = struct{}{}
			alert := generatePostableAlert()
			alert.EndsAt = strfmt.DateTime(expectedTime)
			alert.Labels[ngModels.RuleUIDLabel] = ruleId
		}
		err = am.PutAlerts(apimodels.PostableAlerts{PostableAlerts: alerts})
		require.NoError(t, err)

		err = am.StopAlertsForRules(ruleIds)
		require.NoError(t, err)

		err = am.iterateAlerts(func(f *types.Alert) {
			ID, ok := f.Labels[ngModels.RuleUIDLabel]
			if !ok {
				return
			}
			_, ok = ruleIds[string(ID)]
			if !ok {
				return
			}
			require.Equal(t, expectedTime, f.EndsAt)
		})
		require.NoError(t, err)
	})
	t.Run(fmt.Sprintf("should not update alert that does not have label %s", ngModels.RuleUIDLabel), func(t *testing.T) {
		alerts := make([]models.PostableAlert, 0, rand.Intn(4)+1)
		ruleIds := make(map[string]struct{}, cap(alerts))
		for i := 0; i < rand.Intn(3)+1; i++ {
			ruleIds[util.GenerateShortUID()] = struct{}{}
		}
		expectedEndTime := strfmt.DateTime(time.Now().Add(time.Duration(rand.Intn(120)+5) * time.Second))
		for i := 0; i < cap(alerts); i++ {
			alert := generatePostableAlert()
			alert.EndsAt = expectedEndTime
			alert.Labels["SOME_ID"] = util.GenerateShortUID()
		}
		err = am.PutAlerts(apimodels.PostableAlerts{PostableAlerts: alerts})
		require.NoError(t, err)

		err = am.StopAlertsForRules(ruleIds)
		require.NoError(t, err)

		err = am.iterateAlerts(func(f *types.Alert) {
			ID, ok := f.Labels["SOME_ID"]
			if !ok {
				return
			}
			_, ok = ruleIds[string(ID)]
			if !ok {
				return
			}
			require.Equal(t, expectedEndTime, f.EndsAt)
		})
		require.NoError(t, err)
	})
}

func generatePostableAlert() *models.PostableAlert {
	generateLabelSet := func() models.LabelSet {
		result := make(map[string]string, rand.Intn(5))
		for i := 0; i < len(result); i++ {
			result[strconv.FormatInt(rand.Int63(), 10)] = strconv.FormatFloat(rand.Float64(), 'E', -1, 64)
		}
		return result
	}

	start := time.Unix(rand.Int63n(time.Now().Unix()), 0)
	diff := int64(math.Min(time.Since(start).Seconds(), 60.0))
	end := time.Now().Add(time.Duration(rand.Int63n(120)-diff) * time.Second)

	return &models.PostableAlert{
		Annotations: generateLabelSet(),
		EndsAt:      strfmt.DateTime(end),
		StartsAt:    strfmt.DateTime(start),
		Alert: models.Alert{
			GeneratorURL: strfmt.URI(fmt.Sprintf("http://localhost/%d", rand.Int63())),
			Labels:       generateLabelSet(),
		},
	}
}
