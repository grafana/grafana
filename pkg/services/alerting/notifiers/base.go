package notifiers

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/models"

	"github.com/grafana/grafana/pkg/services/alerting"
)

const (
	triggMetrString = "Triggered metrics:\n\n"
)

type NotifierBase struct {
	Name         string
	Type         string
	Id           int64
	IsDeault     bool
	UploadImage  bool
	SendReminder bool
	Frequency    time.Duration

	log log.Logger
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
		log:          log.New("alerting.notifier." + model.Name),
	}
}

func defaultShouldNotify(context *alerting.EvalContext, sendReminder bool, frequency time.Duration, journals []models.AlertNotificationJournal) bool {
	// Only notify on state change.
	if context.PrevAlertState == context.Rule.State && !sendReminder {
		return false
	}

	// get last successfully sent notification
	lastNotify := time.Time{}
	for _, j := range journals {
		if j.Success {
			lastNotify = time.Unix(j.SentAt, 0)
			break
		}
	}

	// Do not notify if interval has not elapsed
	if sendReminder && !lastNotify.IsZero() && lastNotify.Add(frequency).After(time.Now()) {
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

// ShouldNotify checks this evaluation should send an alert notification
func (n *NotifierBase) ShouldNotify(ctx context.Context, c *alerting.EvalContext) bool {
	cmd := &models.GetLatestNotificationQuery{
		OrgId:      c.Rule.OrgId,
		AlertId:    c.Rule.Id,
		NotifierId: n.Id,
	}

	err := bus.DispatchCtx(ctx, cmd)
	if err != nil {
		n.log.Error("Could not determine last time alert notifier fired", "Alert name", c.Rule.Name, "Error", err)
		return false
	}

	return defaultShouldNotify(c, n.SendReminder, n.Frequency, cmd.Result)
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
