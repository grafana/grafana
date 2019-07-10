package notifiers

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
)

const (
	triggMetrString = "Triggered metrics:\n\n"
)

// NotifierBase is the base implementation of a notifier.
type NotifierBase struct {
	Name                  string
	Type                  string
	UID                   string
	IsDeault              bool
	UploadImage           bool
	SendReminder          bool
	DisableResolveMessage bool
	Frequency             time.Duration

	log log.Logger
}

// NewNotifierBase returns a new `NotifierBase`.
func NewNotifierBase(model *models.AlertNotification) NotifierBase {
	uploadImage := true
	value, exist := model.Settings.CheckGet("uploadImage")
	if exist {
		uploadImage = value.MustBool()
	}

	return NotifierBase{
		UID:                   model.Uid,
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
	return alerting.ShouldNotify(ctx, *context, notiferState,
		alerting.ShouldNotifyOptions{n.Frequency, n.SendReminder, n.DisableResolveMessage})
}

// GetType returns the notifier type.
func (n *NotifierBase) GetType() string {
	return n.Type
}

// NeedsImage returns true if an image is expected in the notification.
func (n *NotifierBase) NeedsImage() bool {
	return n.UploadImage
}

// GetNotifierUID returns the notifier `uid`.
func (n *NotifierBase) GetNotifierUID() string {
	return n.UID
}

// GetIsDefault returns true if the notifiers should
// be used for all alerts.
func (n *NotifierBase) GetIsDefault() bool {
	return n.IsDeault
}

// GetSendReminder returns true if reminders should be sent.
func (n *NotifierBase) GetSendReminder() bool {
	return n.SendReminder
}

// GetDisableResolveMessage returns true if ok alert notifications
// should be skipped.
func (n *NotifierBase) GetDisableResolveMessage() bool {
	return n.DisableResolveMessage
}

// GetFrequency returns the freqency for how often
// alerts should be evaluated.
func (n *NotifierBase) GetFrequency() time.Duration {
	return n.Frequency
}
