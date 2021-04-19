package notifier

import (
	"testing"
	"time"

	"github.com/go-openapi/strfmt"
	apimodels "github.com/grafana/alerting-api/pkg/api"
	"github.com/prometheus/alertmanager/api/v2/models"
	"github.com/prometheus/alertmanager/provider"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"
)

func TestAlertProvider(t *testing.T) {
	marker := types.NewMarker(prometheus.DefaultRegisterer)
	alertProvider := &mockAlertProvider{}

	ap, err := NewAlertProvider(marker)
	require.NoError(t, err)
	ap.Alerts = alertProvider

	startTime := time.Now()
	endTime := startTime.Add(2 * time.Hour)
	postableAlerts := apimodels.PostableAlerts{
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
	}

	require.NoError(t, ap.PutPostableAlert(postableAlerts))

	// Alerts that should be sent for routing.
	expProviderAlerts := []*types.Alert{
		{
			Alert: model.Alert{
				Annotations:  model.LabelSet{"msg": "Alert1 annotation"},
				Labels:       model.LabelSet{"alertname": "Alert1"},
				StartsAt:     startTime,
				EndsAt:       endTime,
				GeneratorURL: "http://localhost/url1",
			},
		}, {
			Alert: model.Alert{
				Annotations:  model.LabelSet{"msg": "Alert2 annotation"},
				Labels:       model.LabelSet{"alertname": "Alert2"},
				EndsAt:       endTime,
				GeneratorURL: "http://localhost/url2",
			},
		}, {
			Alert: model.Alert{
				Annotations:  model.LabelSet{"msg": "Alert3 annotation"},
				Labels:       model.LabelSet{"alertname": "Alert3"},
				StartsAt:     startTime,
				GeneratorURL: "http://localhost/url3",
			},
		}, {
			Alert: model.Alert{
				Annotations:  model.LabelSet{"msg": "Alert4 annotation"},
				Labels:       model.LabelSet{"alertname": "Alert4"},
				GeneratorURL: "http://localhost/url4",
			},
		},
	}
	require.Equal(t, expProviderAlerts, alertProvider.alerts)
}

type mockAlertProvider struct {
	alerts []*types.Alert
}

func (a *mockAlertProvider) Subscribe() provider.AlertIterator           { return nil }
func (a *mockAlertProvider) GetPending() provider.AlertIterator          { return nil }
func (a *mockAlertProvider) Get(model.Fingerprint) (*types.Alert, error) { return nil, nil }

func (a *mockAlertProvider) Put(alerts ...*types.Alert) error {
	a.alerts = append(a.alerts, alerts...)
	return nil
}
