package notifiers

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
)

const (
	triggMetrString = "Triggered metrics:\n\n"
)

type NotifierBase struct {
	Name                  string
	Type                  string
	Uid                   string
	IsDeault              bool
	UploadImage           bool
	SendReminder          bool
	DisableResolveMessage bool
	Frequency             time.Duration

	log log.Logger
}

func NewNotifierBase(model *models.AlertNotification) NotifierBase {
	uploadImage := true
	value, exist := model.Settings.CheckGet("uploadImage")
	if exist {
		uploadImage = value.MustBool()
	}

	return NotifierBase{
		Uid:                   model.Uid,
		Name:                  model.Name,
		IsDeault:              model.IsDefault,
		Type:                  model.Type,
		UploadImage:           uploadImage,
		SendReminder:          model.SendReminder,
		DisableResolveMessage: model.DisableResolveMessage,
		Frequency:             model.Frequency,
		log:                   log.New("alerting.notifier." + model.Name),
	}
}

// ShouldNotify checks this evaluation should send an alert notification
func (n *NotifierBase) ShouldNotify(ctx context.Context, context *alerting.EvalContext, notiferState *models.AlertNotificationState) bool {
	prevState := context.PrevAlertState
	newState := context.Rule.State

	// Only notify on state change.
	if prevState == newState && !n.SendReminder {
		return false
	}

	if prevState == newState && n.SendReminder {
		// Do not notify if interval has not elapsed
		lastNotify := time.Unix(notiferState.UpdatedAt, 0)
		if notiferState.UpdatedAt != 0 && lastNotify.Add(n.Frequency).After(time.Now()) {
			return false
		}

		// Do not notify if alert state is OK or pending even on repeated notify
		if newState == models.AlertStateOK || newState == models.AlertStatePending {
			return false
		}
	}

	unknownOrNoData := prevState == models.AlertStateUnknown || prevState == models.AlertStateNoData
	okOrPending := newState == models.AlertStatePending || newState == models.AlertStateOK

	// Do not notify when new state is ok/pending when previous is unknown or no_data
	if unknownOrNoData && okOrPending {
		return false
	}

	// Do not notify when we become Pending for the first
	if prevState == models.AlertStateNoData && newState == models.AlertStatePending {
		return false
	}

	// Do not notify when we become OK from pending
	if prevState == models.AlertStatePending && newState == models.AlertStateOK {
		return false
	}

	// Do not notify when we OK -> Pending
	if prevState == models.AlertStateOK && newState == models.AlertStatePending {
		return false
	}

	// Do not notify if state pending and it have been updated last minute
	if notiferState.State == models.AlertNotificationStatePending {
		lastUpdated := time.Unix(notiferState.UpdatedAt, 0)
		if lastUpdated.Add(1 * time.Minute).After(time.Now()) {
			return false
		}
	}

	// Do not notify when state is OK if DisableResolveMessage is set to true
	if newState == models.AlertStateOK && n.DisableResolveMessage {
		return false
	}

	return true
}

func (n *NotifierBase) GetType() string {
	return n.Type
}

func (n *NotifierBase) NeedsImage() bool {
	return n.UploadImage
}

func (n *NotifierBase) GetNotifierUid() string {
	return n.Uid
}

func (n *NotifierBase) GetIsDefault() bool {
	return n.IsDeault
}

func (n *NotifierBase) GetSendReminder() bool {
	return n.SendReminder
}

func (n *NotifierBase) GetDisableResolveMessage() bool {
	return n.DisableResolveMessage
}

func (n *NotifierBase) GetFrequency() time.Duration {
	return n.Frequency
}
