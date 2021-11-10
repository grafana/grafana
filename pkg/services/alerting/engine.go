package alerting

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/encryption"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/legacydata"
	"github.com/opentracing/opentracing-go"
	"github.com/opentracing/opentracing-go/ext"
	tlog "github.com/opentracing/opentracing-go/log"
	"golang.org/x/sync/errgroup"
)

// AlertEngine is the background process that
// schedules alert evaluations and makes sure notifications
// are sent.
type AlertEngine struct {
	RenderService    rendering.Service
	Bus              bus.Bus
	RequestValidator models.PluginRequestValidator
	DataService      legacydata.RequestHandler
	Cfg              *setting.Cfg

	execQueue         chan *Job
	ticker            *Ticker
	scheduler         scheduler
	evalHandler       evalHandler
	ruleReader        ruleReader
	log               log.Logger
	resultHandler     resultHandler
	usageStatsService usagestats.Service
}

// IsDisabled returns true if the alerting service is disable for this instance.
func (e *AlertEngine) IsDisabled() bool {
	return !setting.AlertingEnabled || !setting.ExecuteAlerts || e.Cfg.UnifiedAlerting.Enabled
}

// ProvideAlertEngine returns a new AlertEngine.
func ProvideAlertEngine(renderer rendering.Service, bus bus.Bus, requestValidator models.PluginRequestValidator,
	dataService legacydata.RequestHandler, usageStatsService usagestats.Service, encryptionService encryption.Service,
	cfg *setting.Cfg) *AlertEngine {
	e := &AlertEngine{
		Cfg:               cfg,
		RenderService:     renderer,
		Bus:               bus,
		RequestValidator:  requestValidator,
		DataService:       dataService,
		usageStatsService: usageStatsService,
	}
	e.ticker = NewTicker(time.Now(), time.Second*0, clock.New(), 1)
	e.execQueue = make(chan *Job, 1000)
	e.scheduler = newScheduler()
	e.evalHandler = NewEvalHandler(e.DataService)
	e.ruleReader = newRuleReader()
	e.log = log.New("alerting.engine")
	e.resultHandler = newResultHandler(e.RenderService, encryptionService.GetDecryptedValue)

	e.registerUsageMetrics()

	return e
}

// Run starts the alerting service background process.
func (e *AlertEngine) Run(ctx context.Context) error {
	alertGroup, ctx := errgroup.WithContext(ctx)
	alertGroup.Go(func() error { return e.alertingTicker(ctx) })
	alertGroup.Go(func() error { return e.runJobDispatcher(ctx) })

	err := alertGroup.Wait()
	return err
}

func (e *AlertEngine) alertingTicker(grafanaCtx context.Context) error {
	defer func() {
		if err := recover(); err != nil {
			e.log.Error("Scheduler Panic: stopping alertingTicker", "error", err, "stack", log.Stack(1))
		}
	}()

	tickIndex := 0

	for {
		select {
		case <-grafanaCtx.Done():
			return grafanaCtx.Err()
		case tick := <-e.ticker.C:
			// TEMP SOLUTION update rules ever tenth tick
			if tickIndex%10 == 0 {
				e.scheduler.Update(e.ruleReader.fetch(grafanaCtx))
			}

			e.scheduler.Tick(tick, e.execQueue)
			tickIndex++
		}
	}
}

func (e *AlertEngine) runJobDispatcher(grafanaCtx context.Context) error {
	dispatcherGroup, alertCtx := errgroup.WithContext(grafanaCtx)

	for {
		select {
		case <-grafanaCtx.Done():
			return dispatcherGroup.Wait()
		case job := <-e.execQueue:
			dispatcherGroup.Go(func() error { return e.processJobWithRetry(alertCtx, job) })
		}
	}
}

var (
	unfinishedWorkTimeout = time.Second * 5
)

func (e *AlertEngine) processJobWithRetry(grafanaCtx context.Context, job *Job) error {
	defer func() {
		if err := recover(); err != nil {
			e.log.Error("Alert Panic", "error", err, "stack", log.Stack(1))
		}
	}()

	cancelChan := make(chan context.CancelFunc, setting.AlertingMaxAttempts*2)
	attemptChan := make(chan int, 1)

	// Initialize with first attemptID=1
	attemptChan <- 1
	job.SetRunning(true)

	for {
		select {
		case <-grafanaCtx.Done():
			// In case grafana server context is cancel, let a chance to job processing
			// to finish gracefully - by waiting a timeout duration - before forcing its end.
			unfinishedWorkTimer := time.NewTimer(unfinishedWorkTimeout)
			select {
			case <-unfinishedWorkTimer.C:
				return e.endJob(grafanaCtx.Err(), cancelChan, job)
			case <-attemptChan:
				return e.endJob(nil, cancelChan, job)
			}
		case attemptID, more := <-attemptChan:
			if !more {
				return e.endJob(nil, cancelChan, job)
			}
			go e.processJob(attemptID, attemptChan, cancelChan, job)
		}
	}
}

func (e *AlertEngine) endJob(err error, cancelChan chan context.CancelFunc, job *Job) error {
	job.SetRunning(false)
	close(cancelChan)
	for cancelFn := range cancelChan {
		cancelFn()
	}
	return err
}

func (e *AlertEngine) processJob(attemptID int, attemptChan chan int, cancelChan chan context.CancelFunc, job *Job) {
	defer func() {
		if err := recover(); err != nil {
			e.log.Error("Alert Panic", "error", err, "stack", log.Stack(1))
		}
	}()

	alertCtx, cancelFn := context.WithTimeout(context.Background(), setting.AlertingEvaluationTimeout)
	cancelChan <- cancelFn
	span := opentracing.StartSpan("alert execution")
	alertCtx = opentracing.ContextWithSpan(alertCtx, span)

	evalContext := NewEvalContext(alertCtx, job.Rule, e.RequestValidator)
	evalContext.Ctx = alertCtx

	go func() {
		defer func() {
			if err := recover(); err != nil {
				e.log.Error("Alert Panic", "error", err, "stack", log.Stack(1))
				ext.Error.Set(span, true)
				span.LogFields(
					tlog.Error(fmt.Errorf("%v", err)),
					tlog.String("message", "failed to execute alert rule. panic was recovered."),
				)
				span.Finish()
				close(attemptChan)
			}
		}()

		e.evalHandler.Eval(evalContext)

		span.SetTag("alertId", evalContext.Rule.ID)
		span.SetTag("dashboardId", evalContext.Rule.DashboardID)
		span.SetTag("firing", evalContext.Firing)
		span.SetTag("nodatapoints", evalContext.NoDataFound)
		span.SetTag("attemptID", attemptID)

		if evalContext.Error != nil {
			ext.Error.Set(span, true)
			span.LogFields(
				tlog.Error(evalContext.Error),
				tlog.String("message", "alerting execution attempt failed"),
			)
			if attemptID < setting.AlertingMaxAttempts {
				span.Finish()
				e.log.Debug("Job Execution attempt triggered retry", "timeMs", evalContext.GetDurationMs(), "alertId", evalContext.Rule.ID, "name", evalContext.Rule.Name, "firing", evalContext.Firing, "attemptID", attemptID)
				attemptChan <- (attemptID + 1)
				return
			}
		}

		// create new context with timeout for notifications
		resultHandleCtx, resultHandleCancelFn := context.WithTimeout(context.Background(), setting.AlertingNotificationTimeout)
		cancelChan <- resultHandleCancelFn

		// override the context used for evaluation with a new context for notifications.
		// This makes it possible for notifiers to execute when datasources
		// don't respond within the timeout limit. We should rewrite this so notifications
		// don't reuse the evalContext and get its own context.
		evalContext.Ctx = resultHandleCtx
		evalContext.Rule.State = evalContext.GetNewState()
		if err := e.resultHandler.handle(evalContext); err != nil {
			switch {
			case errors.Is(err, context.Canceled):
				e.log.Debug("Result handler returned context.Canceled")
			case errors.Is(err, context.DeadlineExceeded):
				e.log.Debug("Result handler returned context.DeadlineExceeded")
			default:
				e.log.Error("Failed to handle result", "err", err)
			}
		}

		span.Finish()
		e.log.Debug("Job Execution completed", "timeMs", evalContext.GetDurationMs(), "alertId", evalContext.Rule.ID, "name", evalContext.Rule.Name, "firing", evalContext.Firing, "attemptID", attemptID)
		close(attemptChan)
	}()
}

func (e *AlertEngine) registerUsageMetrics() {
	e.usageStatsService.RegisterMetricsFunc(func(ctx context.Context) (map[string]interface{}, error) {
		alertingUsageStats, err := e.QueryUsageStats(ctx)
		if err != nil {
			return nil, err
		}

		alertingOtherCount := 0
		metrics := map[string]interface{}{}

		for dsType, usageCount := range alertingUsageStats.DatasourceUsage {
			if e.usageStatsService.ShouldBeReported(dsType) {
				metrics[fmt.Sprintf("stats.alerting.ds.%s.count", dsType)] = usageCount
			} else {
				alertingOtherCount += usageCount
			}
		}

		metrics["stats.alerting.ds.other.count"] = alertingOtherCount

		return metrics, nil
	})
}
