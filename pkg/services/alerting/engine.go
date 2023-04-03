package alerting

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/attribute"
	"golang.org/x/sync/errgroup"

	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/infra/usagestats/validator"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/encryption"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/services/validations"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/legacydata"
	"github.com/grafana/grafana/pkg/util/ticker"
)

// AlertEngine is the background process that
// schedules alert evaluations and makes sure notifications
// are sent.
type AlertEngine struct {
	RenderService    rendering.Service
	RequestValidator validations.PluginRequestValidator
	DataService      legacydata.RequestHandler
	Cfg              *setting.Cfg

	execQueue          chan *Job
	ticker             *ticker.T
	scheduler          scheduler
	evalHandler        evalHandler
	ruleReader         ruleReader
	log                log.Logger
	resultHandler      resultHandler
	usageStatsService  usagestats.Service
	validator          validator.Service
	tracer             tracing.Tracer
	AlertStore         AlertStore
	dashAlertExtractor DashAlertExtractor
	dashboardService   dashboards.DashboardService
	datasourceService  datasources.DataSourceService
	annotationsRepo    annotations.Repository
}

// IsDisabled returns true if the alerting service is disabled for this instance.
func (e *AlertEngine) IsDisabled() bool {
	return setting.AlertingEnabled == nil || !*setting.AlertingEnabled || !setting.ExecuteAlerts || e.Cfg.UnifiedAlerting.IsEnabled()
}

// ProvideAlertEngine returns a new AlertEngine.
func ProvideAlertEngine(renderer rendering.Service, requestValidator validations.PluginRequestValidator,
	dataService legacydata.RequestHandler, usageStatsService usagestats.Service, validator validator.Service, encryptionService encryption.Internal,
	notificationService *notifications.NotificationService, tracer tracing.Tracer, store AlertStore, cfg *setting.Cfg,
	dashAlertExtractor DashAlertExtractor, dashboardService dashboards.DashboardService, cacheService *localcache.CacheService, dsService datasources.DataSourceService, annotationsRepo annotations.Repository) *AlertEngine {
	e := &AlertEngine{
		Cfg:                cfg,
		RenderService:      renderer,
		RequestValidator:   requestValidator,
		DataService:        dataService,
		usageStatsService:  usageStatsService,
		validator:          validator,
		tracer:             tracer,
		AlertStore:         store,
		dashAlertExtractor: dashAlertExtractor,
		dashboardService:   dashboardService,
		datasourceService:  dsService,
		annotationsRepo:    annotationsRepo,
	}
	e.execQueue = make(chan *Job, 1000)
	e.scheduler = newScheduler()
	e.evalHandler = NewEvalHandler(e.DataService)
	e.ruleReader = newRuleReader(store)
	e.log = log.New("alerting.engine")
	e.resultHandler = newResultHandler(e.RenderService, store, notificationService, encryptionService.GetDecryptedValue)

	e.registerUsageMetrics()

	return e
}

// Run starts the alerting service background process.
func (e *AlertEngine) Run(ctx context.Context) error {
	reg := prometheus.WrapRegistererWithPrefix("legacy_", prometheus.DefaultRegisterer)
	e.ticker = ticker.New(clock.New(), 1*time.Second, ticker.NewMetrics(reg, "alerting"))
	defer e.ticker.Stop()
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
	alertCtx, span := e.tracer.Start(alertCtx, "alert execution")
	evalContext := NewEvalContext(alertCtx, job.Rule, e.RequestValidator, e.AlertStore, e.dashboardService, e.datasourceService, e.annotationsRepo)
	evalContext.Ctx = alertCtx

	go func() {
		defer func() {
			if err := recover(); err != nil {
				e.log.Error("Alert Panic", "error", err, "stack", log.Stack(1))
				span.RecordError(fmt.Errorf("%v", err))
				span.AddEvents(
					[]string{"error", "message"},
					[]tracing.EventValue{
						{Str: fmt.Sprintf("%v", err)},
						{Str: "failed to execute alert rule. panic was recovered."},
					})
				span.End()
				close(attemptChan)
			}
		}()

		e.evalHandler.Eval(evalContext)

		span.SetAttributes("alertId", evalContext.Rule.ID, attribute.Key("alertId").Int64(evalContext.Rule.ID))
		span.SetAttributes("dashboardId", evalContext.Rule.DashboardID, attribute.Key("dashboardId").Int64(evalContext.Rule.DashboardID))
		span.SetAttributes("firing", evalContext.Firing, attribute.Key("firing").Bool(evalContext.Firing))
		span.SetAttributes("nodatapoints", evalContext.NoDataFound, attribute.Key("nodatapoints").Bool(evalContext.NoDataFound))
		span.SetAttributes("attemptID", attemptID, attribute.Key("attemptID").Int(attemptID))

		if evalContext.Error != nil {
			span.RecordError(evalContext.Error)
			span.AddEvents(
				[]string{"error", "message"},
				[]tracing.EventValue{
					{Str: fmt.Sprintf("%v", evalContext.Error)},
					{Str: "alerting execution attempt failed"},
				})

			if attemptID < setting.AlertingMaxAttempts {
				span.End()
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

		span.End()
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
			if e.validator.ShouldBeReported(ctx, dsType) {
				metrics[fmt.Sprintf("stats.alerting.ds.%s.count", dsType)] = usageCount
			} else {
				alertingOtherCount += usageCount
			}
		}

		metrics["stats.alerting.ds.other.count"] = alertingOtherCount

		return metrics, nil
	})
}
