package notifiers

import (
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
)

type NotifierBase struct {
	Name         string
	Type         string
	Id           int64
	IsDeault     bool
	UploadImage  bool
	SendReminder bool
	Frequency    time.Duration
}

func NewNotifierBase(model *models.AlertNotification) NotifierBase {
	uploadImage := true
	value, exist := model.Settings.CheckGet("uploadImage")
	if exist {
		uploadImage = value.MustBool()
	}

	return NotifierBase{
		Id:           model.Id,
		Name:         model.Name,
		IsDeault:     model.IsDefault,
		Type:         model.Type,
		UploadImage:  uploadImage,
		SendReminder: model.SendReminder,
		Frequency:    model.Frequency,
	}
}

func defaultShouldNotify(context *alerting.EvalContext, sendReminder bool, frequency time.Duration, lastNotify *time.Time) bool {
	// Only notify on state change.
	if context.PrevAlertState == context.Rule.State && !sendReminder {
		return false
	}

	// Do not notify if interval has not elapsed
	if sendReminder && lastNotify != nil && lastNotify.Add(frequency).After(time.Now()) {
		return false
	}

	// Do not notify if alert state if OK or pending even on repeated notify
	if sendReminder && (context.Rule.State == models.AlertStateOK || context.Rule.State == models.AlertStatePending) {
		return false
	}

	// Do not notify when we become OK for the first time.
	if (context.PrevAlertState == models.AlertStatePending) && (context.Rule.State == models.AlertStateOK) {
		return false
	}
	return true
}

func (n *NotifierBase) ShouldNotify(context *alerting.EvalContext) bool {
	lastNotify := context.LastNotify(n.Id)
	return defaultShouldNotify(context, n.SendReminder, n.Frequency, lastNotify)
}

func (n *NotifierBase) GetType() string {
	return n.Type
}

func (n *NotifierBase) NeedsImage() bool {
	return n.UploadImage
}

func (n *NotifierBase) GetNotifierId() int64 {
	return n.Id
}

func (n *NotifierBase) GetIsDefault() bool {
	return n.IsDeault
}

func (n *NotifierBase) GetSendReminder() bool {
	return n.SendReminder
}

func (n *NotifierBase) GetFrequency() time.Duration {
	return n.Frequency
}
