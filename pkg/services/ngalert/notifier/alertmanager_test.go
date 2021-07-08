package notifier

import (
	"context"
	"errors"
	"io/ioutil"
	"os"
	"sort"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"

	gokit_log "github.com/go-kit/kit/log"
	"github.com/go-openapi/strfmt"
	"github.com/prometheus/alertmanager/api/v2/models"
	"github.com/prometheus/alertmanager/provider/mem"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"

	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/logging"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
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

	m := metrics.NewMetrics(prometheus.NewRegistry())
	sqlStore := sqlstore.InitTestDB(t)
	store := &store.DBstore{
		BaseInterval:           10 * time.Second,
		DefaultIntervalSeconds: 60,
		SQLStore:               sqlStore,
		Logger:                 log.New("alertmanager-test"),
	}

	am, err := New(cfg, store, m)
	require.NoError(t, err)
	return am
}

func TestAlertmanager_ShouldUseDefaultConfigurationWhenNoConfiguration(t *testing.T) {
	am := setupAMTest(t)
	require.NoError(t, am.SyncAndApplyConfigFromDatabase())
	require.NotNil(t, am.config)
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
			title: "Invalid labels",
			postableAlerts: apimodels.PostableAlerts{
				PostableAlerts: []models.PostableAlert{
					{
						Alert: models.Alert{
							Labels: models.LabelSet{"alertname$": "Alert1"},
						},
					},
				},
			},
			expError: &AlertValidationError{
				Alerts: []models.PostableAlert{
					{
						Alert: models.Alert{
							Labels: models.LabelSet{"alertname$": "Alert1"},
						},
					},
				},
				Errors: []error{errors.New("invalid label set: invalid name \"alertname$\"")},
			},
		}, {
			title: "Invalid annotation",
			postableAlerts: apimodels.PostableAlerts{
				PostableAlerts: []models.PostableAlert{
					{
						Annotations: models.LabelSet{"msg$": "Alert4 annotation"},
						Alert: models.Alert{
							Labels: models.LabelSet{"alertname": "Alert1"},
						},
					},
				},
			},
			expError: &AlertValidationError{
				Alerts: []models.PostableAlert{
					{
						Annotations: models.LabelSet{"msg$": "Alert4 annotation"},
						Alert: models.Alert{
							Labels: models.LabelSet{"alertname": "Alert1"},
						},
					},
				},
				Errors: []error{errors.New("invalid annotations: invalid name \"msg$\"")},
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
			am.alerts, err = mem.NewAlerts(context.Background(), am.marker, 15*time.Minute, gokit_log.NewLogfmtLogger(logging.NewWrapper(am.logger)))
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
