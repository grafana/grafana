package alerting

import (
	"context"
	"time"
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
	ShouldNotify(ctx context.Context, evalContext *EvalContext) bool

	GetNotifierId() int64
	GetIsDefault() bool
	GetSendReminder() bool
	GetFrequency() time.Duration
}

type NotifierSlice []Notifier

func (notifiers NotifierSlice) ShouldUploadImage() bool {
	for _, notifier := range notifiers {
		if notifier.NeedsImage() {
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
