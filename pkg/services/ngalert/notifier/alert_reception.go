package notifier

import (
	"context"
	"time"

	gokit_log "github.com/go-kit/kit/log"
	apimodels "github.com/grafana/alerting-api/pkg/api"
	"github.com/prometheus/alertmanager/api/v2/models"
	"github.com/prometheus/alertmanager/provider"
	"github.com/prometheus/alertmanager/provider/mem"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"
)

type AlertProvider struct {
	provider.Alerts
}

// NewAlertProvider returns AlertProvider that provides a method to translate
// Grafana alerts to Prometheus Alertmanager alerts before passing it ahead.
func NewAlertProvider(m types.Marker) (*AlertProvider, error) {
	alerts, err := mem.NewAlerts(context.Background(), m, 30*time.Minute, gokit_log.NewNopLogger())
	if err != nil {
		return nil, err
	}

	return &AlertProvider{Alerts: alerts}, nil
}

func (ap *AlertProvider) PutPostableAlert(postableAlerts apimodels.PostableAlerts) error {
	alerts := make([]*types.Alert, 0, len(postableAlerts.PostableAlerts))
	for _, a := range postableAlerts.PostableAlerts {
		alerts = append(alerts, alertForDelivery(a))
	}
	return ap.Alerts.Put(alerts...)
}

func alertForDelivery(a models.PostableAlert) *types.Alert {
	lbls := model.LabelSet{}
	annotations := model.LabelSet{}
	for k, v := range a.Labels {
		lbls[model.LabelName(k)] = model.LabelValue(v)
	}
	for k, v := range a.Annotations {
		annotations[model.LabelName(k)] = model.LabelValue(v)
	}

	return &types.Alert{
		Alert: model.Alert{
			Labels:       lbls,
			Annotations:  annotations,
			StartsAt:     time.Time(a.StartsAt),
			EndsAt:       time.Time(a.EndsAt),
			GeneratorURL: a.GeneratorURL.String(),
		},
		UpdatedAt: time.Time{}, // TODO(codesome) what should this be?
		Timeout:   false,       // TODO(codesome).
	}
}
