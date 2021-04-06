package notifier

import (
	"context"
	"errors"
	"testing"

	"github.com/go-kit/kit/log"
	"github.com/prometheus/alertmanager/api/v2/models"
	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/provider"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"
)

func TestAlertProvider_PutPostableAlert(t *testing.T) {
	marker := types.NewMarker(prometheus.DefaultRegisterer)
	stage := &mockStage{alerts: make(map[string][]*types.Alert)}
	provider := &mockAlertProvider{}

	ap, err := NewAlertProvider(stage, marker)
	require.NoError(t, err)
	ap.Alerts = provider

	postableAlerts := []*PostableAlert{
		{
			// Goes through routing since no receiver.
			PostableAlert: models.PostableAlert{
				Annotations: models.LabelSet{"msg": "AlertOne annotation"},
				Alert: models.Alert{
					Labels: models.LabelSet{"alertname": "AlertOne"},
				},
			},
		}, {
			// Goes directly through notification pipeling since there is receiver.
			PostableAlert: models.PostableAlert{
				Annotations: models.LabelSet{"msg": "AlertTwo annotation"},
				Alert: models.Alert{
					Labels: models.LabelSet{"alertname": "AlertTwo"},
				},
			},
			Receivers: []string{"recv1", "recv2"},
		}, {
			// Goes directly through notification pipeling since there is receiver.
			PostableAlert: models.PostableAlert{
				Annotations: models.LabelSet{"msg": "AlertThree annotation"},
				Alert: models.Alert{
					Labels: models.LabelSet{"alertname": "AlertThree"},
				},
			},
			Receivers: []string{"recv2", "recv3"},
		},
	}

	require.NoError(t, ap.PutPostableAlert(postableAlerts...))

	// Alerts that should be sent for routing.
	expProviderAlerts := []*types.Alert{
		{
			Alert: model.Alert{
				Annotations: model.LabelSet{"msg": "AlertOne annotation"},
				Labels:      model.LabelSet{"alertname": "AlertOne"},
			},
		},
	}
	require.Equal(t, expProviderAlerts, provider.alerts)

	// Alerts that should go directly to the notification pipeline.
	expPipelineAlerts := map[string][]*types.Alert{
		"recv1": {
			{
				Alert: model.Alert{
					Annotations: model.LabelSet{"msg": "AlertTwo annotation"},
					Labels:      model.LabelSet{"alertname": "AlertTwo"},
				},
			},
		},
		"recv2": {
			{
				Alert: model.Alert{
					Annotations: model.LabelSet{"msg": "AlertTwo annotation"},
					Labels:      model.LabelSet{"alertname": "AlertTwo"},
				},
			}, {
				Alert: model.Alert{
					Annotations: model.LabelSet{"msg": "AlertThree annotation"},
					Labels:      model.LabelSet{"alertname": "AlertThree"},
				},
			},
		},
		"recv3": {
			{
				Alert: model.Alert{
					Annotations: model.LabelSet{"msg": "AlertThree annotation"},
					Labels:      model.LabelSet{"alertname": "AlertThree"},
				},
			},
		},
	}
	require.Equal(t, expPipelineAlerts, stage.alerts)
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

type mockStage struct {
	alerts map[string][]*types.Alert
}

func (s *mockStage) Exec(ctx context.Context, _ log.Logger, alerts ...*types.Alert) (context.Context, []*types.Alert, error) {
	recv, ok := notify.ReceiverName(ctx)
	if !ok {
		return ctx, nil, errors.New("receiver name not found")
	}
	s.alerts[recv] = append(s.alerts[recv], alerts...)
	return ctx, nil, nil
}
