package notifiers

import (
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
)

type NotifierBase struct {
	Name        string
	Type        string
	Id          int64
	IsDeault    bool
	UploadImage bool
	NotifyOnce  bool
	Frequency   time.Duration
}

func NewNotifierBase(id int64, isDefault bool, name, notifierType string, notifyOnce bool, frequency time.Duration, model *simplejson.Json) NotifierBase {
	uploadImage := true
	value, exist := model.CheckGet("uploadImage")
	if exist {
		uploadImage = value.MustBool()
	}

	return NotifierBase{
		Id:          id,
		Name:        name,
		IsDeault:    isDefault,
		Type:        notifierType,
		UploadImage: uploadImage,
		NotifyOnce:  notifyOnce,
		Frequency:   frequency,
	}
}

func defaultShouldNotify(context *alerting.EvalContext, notifyOnce bool, frequency time.Duration, lastNotify *time.Time) bool {
	// Only notify on state change.
	if context.PrevAlertState == context.Rule.State && notifyOnce {
		return false
	}
	// Do not notify if interval has not elapsed
	if !notifyOnce && lastNotify != nil && lastNotify.Add(frequency).After(time.Now()) {
		return false
	}
	// Do not notify when we become OK for the first time.
	if (context.PrevAlertState == m.AlertStatePending) && (context.Rule.State == m.AlertStateOK) {
		return false
	}
	return true
}

func (n *NotifierBase) ShouldNotify(context *alerting.EvalContext) bool {
	lastNotify := context.LastNotify(n.Id)
	return defaultShouldNotify(context, n.NotifyOnce, n.Frequency, lastNotify)
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

func (n *NotifierBase) GetNotifyOnce() bool {
	return n.NotifyOnce
}

func (n *NotifierBase) GetFrequency() time.Duration {
	return n.Frequency
}
