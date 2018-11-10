package alerting

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/models"
)

type EvalHandler interface {
	Eval(evalContext *EvalContext)
}

type Scheduler interface {
	Tick(time time.Time, execQueue chan *Job)
	Update(rules []*Rule)
}

type Notifier interface {
	Notify(evalContext *EvalContext) error
	GetType() string
	NeedsImage() bool

	// ShouldNotify checks this evaluation should send an alert notification
	ShouldNotify(ctx context.Context, evalContext *EvalContext, notificationState *models.AlertNotificationState) bool

	GetNotifierId() int64
	GetIsDefault() bool
	GetSendReminder() bool
	GetDisableResolveMessage() bool
	GetFrequency() time.Duration
}

type notifierState struct {
	notifier Notifier
	state    *models.AlertNotificationState
}

type notifierStateSlice []*notifierState

func (notifiers notifierStateSlice) ShouldUploadImage() bool {
	for _, ns := range notifiers {
		if ns.notifier.NeedsImage() {
			return true
		}
	}

	return false
}

type ConditionResult struct {
	Firing      bool
	NoDataFound bool
	Operator    string
	EvalMatches []*EvalMatch
}

type Condition interface {
	Eval(result *EvalContext) (*ConditionResult, error)
}
