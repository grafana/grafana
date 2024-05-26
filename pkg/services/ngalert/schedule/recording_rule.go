package schedule

import (
	context "context"

	"github.com/grafana/grafana/pkg/infra/log"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/util"
)

type recordingRule struct {
	ctx    context.Context
	stopFn util.CancelCauseFunc

	logger log.Logger
}

func newRecordingRule(parent context.Context, logger log.Logger) *recordingRule {
	ctx, stop := util.WithCancelCause(parent)
	return &recordingRule{
		ctx:    ctx,
		stopFn: stop,
		logger: logger,
	}
}

func (r *recordingRule) Eval(eval *Evaluation) (bool, *Evaluation) {
	return true, nil
}

func (r *recordingRule) Update(lastVersion RuleVersionAndPauseStatus) bool {
	return true
}

func (r *recordingRule) Stop(reason error) {
	if r.stopFn != nil {
		r.stopFn(reason)
	}
}

func (r *recordingRule) Run(key ngmodels.AlertRuleKey) error {
	ctx := ngmodels.WithRuleKey(r.ctx, key)
	logger := r.logger.FromContext(ctx)
	logger.Debug("Recording rule routine started")

	// nolint:gosimple
	for {
		select {
		case <-ctx.Done():
			logger.Debug("Stopping recording rule routine")
			return nil
		}
	}
}
