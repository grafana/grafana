package schedule

import (
	"context"
	"hash/fnv"
	"net/url"
	"time"
	"unsafe"

	"github.com/benbjohnson/clock"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	"github.com/grafana/grafana/pkg/util/ticker"
)

// Rule represents a single piece of work that is executed periodically by the group that owns it.
type Rule interface {
	// new
	doEval(ctx context.Context, tick time.Time, folderTitle string)
	getKey() models.AlertRuleKey
	getHash() fingerprint
}

type ruleFactoryFunc func(context.Context, *models.AlertRule, string) Rule

func (f ruleFactoryFunc) new(ctx context.Context, rule *models.AlertRule, folderTitle string) Rule {
	return f(ctx, rule, folderTitle)
}

func NewRuleFactory(
	appURL *url.URL,
	disableGrafanaFolder bool,
	maxAttempts int64,
	sender AlertsSender,
	stateManager *state.Manager,
	evalFactory eval.EvaluatorFactory,
	clock clock.Clock,
	featureToggles featuremgmt.FeatureToggles,
	met *metrics.Scheduler,
	logger log.Logger,
	tracer tracing.Tracer,
	recordingWriter RecordingWriter,
) ruleFactoryFunc {
	return func(ctx context.Context, rule *models.AlertRule, folderTitle string) Rule {
		return createRule(
			appURL,
			disableGrafanaFolder,
			maxAttempts,
			sender,
			stateManager,
			evalFactory,
			clock,
			featureToggles,
			met,
			logger,
			tracer,
			recordingWriter,
			ctx,
			rule,
			folderTitle,
		)
	}
}

func createRule(
	appURL *url.URL,
	disableGrafanaFolder bool,
	maxAttempts int64,
	sender AlertsSender,
	stateManager *state.Manager,
	evalFactory eval.EvaluatorFactory,
	clock clock.Clock,
	featureToggles featuremgmt.FeatureToggles,
	met *metrics.Scheduler,
	logger log.Logger,
	tracer tracing.Tracer,
	recordingWriter RecordingWriter,
	ctx context.Context,
	rule *models.AlertRule,
	folderTitle string,
) Rule {
	fp := ruleWithFolder{rule: rule, folderTitle: folderTitle}.Fingerprint()
	if rule.Type() == models.RuleTypeRecording {
		return newRecordingRule(
			ctx,
			rule,
			fp,
			maxAttempts,
			clock,
			evalFactory,
			featureToggles,
			logger,
			met,
			tracer,
			recordingWriter,
		)
	}
	return newAlertRule(
		ctx,
		rule,
		fp,
		appURL,
		disableGrafanaFolder,
		maxAttempts,
		sender,
		stateManager,
		evalFactory,
		clock,
		met,
		logger,
		tracer,
	)
}

type VersionedGroup struct {
	Fingerprint fingerprint
}

type Group struct {
	fingerprint fingerprint
	group       *models.AlertRuleGroup
	groupKey    models.AlertRuleGroupKey
	interval    time.Duration
	rules       []Rule

	ctx        context.Context
	cancelFn   context.CancelCauseFunc
	terminated chan struct{}

	clock        clock.Clock
	baseInterval time.Duration

	folderCache folderCache

	metrics *metrics.Scheduler
	logger  log.Logger

	sequentialEval bool
	jitterStrategy JitterStrategy
}

type groupFactoryFn func(context.Context, *models.AlertRuleGroup, string) *Group

func (f groupFactoryFn) new(ctx context.Context, group *models.AlertRuleGroup, folderTitle string) *Group {
	return f(ctx, group, folderTitle)
}

func NewGroupFactory(
	ruleFactory ruleFactoryFunc,
	clock clock.Clock,
	baseInterval time.Duration,
	metrics *metrics.Scheduler,
	logger log.Logger,
	sequentialEval bool,
	jitterStrategy JitterStrategy,
) groupFactoryFn {
	return func(ctx context.Context, group *models.AlertRuleGroup, folderTitle string) *Group {
		return newRuleGroup(ctx, group, ruleFactory, folderTitle, clock, baseInterval, metrics, logger, sequentialEval, jitterStrategy)
	}
}

func newRuleGroup(
	ctx context.Context,
	group *models.AlertRuleGroup,
	ruleFactory ruleFactoryFunc,
	folderTitle string,
	clock clock.Clock,
	baseInterval time.Duration,
	metrics *metrics.Scheduler,
	logger log.Logger,
	sequentialEval bool,
	jitterStrategy JitterStrategy,
) *Group {
	groupCtx, cancelFn := context.WithCancelCause(models.WithRuleGroupKey(ctx, group.GetGroupKey()))
	scheduledRules := make([]Rule, len(group.Rules))

	for _, rule := range group.Rules {
		ruleCtx := models.WithRuleKey(groupCtx, rule.GetKey())
		scheduledRule := ruleFactory.new(ruleCtx, &rule, folderTitle)
		scheduledRules[rule.RuleGroupIndex] = scheduledRule
	}

	return &Group{
		group:          group,
		groupKey:       group.GetGroupKey(),
		interval:       time.Duration(group.Interval * int64(time.Second)),
		rules:          scheduledRules,
		ctx:            groupCtx,
		cancelFn:       cancelFn,
		terminated:     make(chan struct{}),
		clock:          clock,
		baseInterval:   baseInterval,
		metrics:        metrics,
		logger:         logger.FromContext(groupCtx),
		sequentialEval: sequentialEval,
		jitterStrategy: jitterStrategy,
	}
}

func (g *Group) Stop(reason error) {
	g.cancelFn(reason)
	<-g.terminated
}

func (g *Group) Run() {
	defer close(g.terminated)

	// Wait an initial amount to have consistently slotted intervals
	evalTs := g.EvalTimestamp(g.clock.Now().UnixNano()).Add(g.interval)
	select {
	case <-time.After(time.Until(evalTs)):
	case <-g.ctx.Done():
		return
	}

	g.logger.Debug("Starting rule group")
	t := ticker.New(g.clock, g.baseInterval, g.metrics.Ticker)
	defer t.Stop()

	for {
		select {
		case tick := <-t.C:
			g.logger.Debug("Tick", "tick", tick)
			ready := g.checkReady(tick)
			if !ready {
				continue
			}

			ctx, cancel := context.WithTimeout(g.ctx, g.interval)
			defer cancel()

			g.tryEval(ctx, tick)

			if err := ctx.Err(); err == context.DeadlineExceeded {
				g.logger.Debug("Evaluation took too long", "tick", tick)
			} else if err != nil {
				g.logger.Error("Evaluation cancelled by a child process", "tick", tick)
			}
		case <-g.ctx.Done():
			return
		}
	}
}

func (g *Group) checkReady(tick time.Time) (ready bool) {
	absTick := tick.Unix() / int64(g.baseInterval.Seconds())
	freq := g.group.Interval / int64(g.baseInterval.Seconds())
	offset := jitterOffsetInTicks(g.group.Interval, g.groupKey, g.baseInterval, g.jitterStrategy)
	ready = g.group.Interval != 0 && (absTick%freq)-offset == 0
	return ready
}

func (g *Group) tryEval(ctx context.Context, tick time.Time) {
	fk := g.group.GetFolderKey()
	ft, ok := g.folderCache.get(g.group.GetFolderKey())
	if !ok {
		g.logger.Error("Folder key not in cache", "folder_key", fk)
		return
	}

	for _, rule := range g.rules {
		l := g.logger.New("current_tick", tick, "rule_key", rule.getKey())

		if g.ctx.Err() != nil {
			l.Debug("Cancelled tick")
			return
		}

		if g.sequentialEval {
			rule.doEval(ctx, tick, ft)
		} else {
			go func(r Rule) {
				rule.doEval(ctx, tick, ft)
			}(rule)
		}
	}
}

func (g *Group) Equals(other *Group) bool {
	if g.group.GetGroupKey() != other.group.GetGroupKey() {
		return false
	}

	if len(g.rules) != len(other.rules) {
		return false
	}

	for i, rule := range g.rules {
		if !(rule.getHash() == other.rules[i].getHash()) {
			return false
		}
	}

	return true
}

func (g *Group) hash() fingerprint {
	group := g.group
	sum := fnv.New64()
	writeBytes := func(b []byte) {
		_, _ = sum.Write(b)
		_, _ = sum.Write(fingerprintSeparator)
	}

	writeString := func(s string) {
		if len(s) == 0 {
			writeBytes(nil)
			return
		}
		// #nosec G103
		// avoid allocation when converting string to byte slice
		writeBytes(unsafe.Slice(unsafe.StringData(s), len(s)))
	}

	writeString(group.Title)
	writeString(group.FolderUID)

	return fingerprint(sum.Sum64())
}

// From github.com/prometheus/prometheus/pkg/rules/group.go
// EvalTimestamp returns the immediately preceding consistently slotted evaluation time.
func (g *Group) EvalTimestamp(startTime int64) time.Time {
	var (
		offset = int64(uint64(g.hash()) % uint64(g.interval))

		// This group's evaluation times differ from the perfect time intervals by `offset` nanoseconds.
		// But we can only use `% interval` to align with the interval. And `% interval` will always
		// align with the perfect time intervals, instead of this group's. Because of this we add
		// `offset` _after_ aligning with the perfect time interval.
		//
		// There can be cases where adding `offset` to the perfect evaluation time can yield a
		// timestamp in the future, which is not what EvalTimestamp should do.
		// So we subtract one `offset` to make sure that `now - (now % interval) + offset` gives an
		// evaluation time in the past.
		adjNow = startTime - offset

		// Adjust to perfect evaluation intervals.
		base = adjNow - (adjNow % int64(g.interval))

		// Add one offset to randomize the evaluation times of this group.
		next = base + offset
	)

	return time.Unix(0, next).UTC()
}
