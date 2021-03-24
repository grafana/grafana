package notifier

import (
	"context"
	"sync"
	"time"

	gokit_log "github.com/go-kit/kit/log"

	"github.com/prometheus/alertmanager/api/v2/models"
	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/provider"
	"github.com/prometheus/alertmanager/provider/mem"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"
)

type PostableAlert struct {
	models.PostableAlert

	// List of receiver names to sent alert to
	Receivers []string `json:"receivers"`
}

type AlertProvider struct {
	provider.Alerts

	// TODO(codesome): This stage is temporary to get code out quickly.
	// Eventually, the alerts meant directly for receivers and not routing
	// will be stored in memory and provided via an iterator, for example
	// GetPendingLegacy() AlertIterator, and the external code will use this
	// iterator to send to the stage.
	stage    notify.Stage
	stageMtx sync.Mutex
}

// NewAlertProvider returns AlertProvider that also supports legacy alerts via PutPostableAlert.
// The notify.Stage should be of the type notify.RoutingStage or something similar that takes
// notification channel name from the context.
func NewAlertProvider(s notify.Stage, m types.Marker) (*AlertProvider, error) {
	alerts, err := mem.NewAlerts(context.Background(), m, 30*time.Minute, gokit_log.NewNopLogger())
	if err != nil {
		return nil, err
	}

	return &AlertProvider{
		Alerts: alerts,
		stage:  s,
	}, nil
}

func (ap *AlertProvider) PutPostableAlert(alerts ...*PostableAlert) error {
	var alertsWithReceivers []*PostableAlert
	var alertsWithoutReceivers []*types.Alert
	for _, a := range alerts {
		if len(a.Receivers) > 0 {
			alertsWithReceivers = append(alertsWithReceivers, a)
		} else {
			alertsWithoutReceivers = append(alertsWithoutReceivers, alertForDelivery(a))
		}
	}

	// Without receiver names, alerts go through routing.
	if err := ap.Alerts.Put(alertsWithoutReceivers...); err != nil {
		return err
	}

	if len(alertsWithReceivers) == 0 || ap.stage == nil {
		return nil
	}

	// Group alerts with receivers based on the receiver names.
	groupedAlerts := make(map[string][]*types.Alert)
	for _, a := range alertsWithReceivers {
		for _, recv := range a.Receivers {
			groupedAlerts[recv] = append(groupedAlerts[recv], alertForDelivery(a))
		}
	}

	for recv, alerts := range groupedAlerts {
		ap.stageMtx.Lock()
		ctx := notify.WithReceiverName(context.Background(), recv)
		_, _, err := ap.stage.Exec(ctx, gokit_log.NewNopLogger(), alerts...)
		ap.stageMtx.Unlock()
		if err != nil {
			return err
		}
	}

	return nil
}

func (ap *AlertProvider) SetStage(s notify.Stage) {
	ap.stageMtx.Lock()
	defer ap.stageMtx.Unlock()
	ap.stage = s
}

func alertForDelivery(a *PostableAlert) *types.Alert {
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
