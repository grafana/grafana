package ngalert

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"golang.org/x/sync/errgroup"
)

type scheduleService interface {
	Ticker(context.Context) error
	Pause() error
	Unpause() error

	// the following are used by tests only used for tests
	evalApplied(alertDefinitionKey, time.Time)
	stopApplied(alertDefinitionKey)
	overrideCfg(cfg schedulerCfg)
}

func (sch *schedule) definitionRoutine(grafanaCtx context.Context, key alertDefinitionKey, evalCh <-chan *evalContext, stopCh <-chan struct{}) error {
	sch.log.Debug("alert definition routine started", "key", key)

	evalRunning := false
	var start, end time.Time
	var attempt int64
	var alertDefinition *AlertDefinition
	for {
		select {
		case ctx := <-evalCh:
			if evalRunning {
				continue
			}

			evaluate := func(attempt int64) error {
				start = timeNow()

				// fetch latest alert definition version
				if alertDefinition == nil || alertDefinition.Version < ctx.version {
					q := getAlertDefinitionByUIDQuery{OrgID: key.orgID, UID: key.definitionUID}
					err := sch.store.getAlertDefinitionByUID(&q)
					if err != nil {
						sch.log.Error("failed to fetch alert definition", "key", key)
						return err
					}
					alertDefinition = q.Result
					sch.log.Debug("new alert definition version fetched", "title", alertDefinition.Title, "key", key, "version", alertDefinition.Version)
				}

				condition := eval.Condition{
					RefID:                 alertDefinition.Condition,
					OrgID:                 alertDefinition.OrgID,
					QueriesAndExpressions: alertDefinition.Data,
				}
				results, err := sch.evaluator.ConditionEval(&condition, ctx.now)
				end = timeNow()
				if err != nil {
					// consider saving alert instance on error
					sch.log.Error("failed to evaluate alert definition", "title", alertDefinition.Title, "key", key, "attempt", attempt, "now", ctx.now, "duration", end.Sub(start), "error", err)
					return err
				}
				for _, r := range results {
					sch.log.Debug("alert definition result", "title", alertDefinition.Title, "key", key, "attempt", attempt, "now", ctx.now, "duration", end.Sub(start), "instance", r.Instance, "state", r.State.String())
					cmd := saveAlertInstanceCommand{DefinitionOrgID: key.orgID, DefinitionUID: key.definitionUID, State: InstanceStateType(r.State.String()), Labels: InstanceLabels(r.Instance), LastEvalTime: ctx.now}
					err := sch.store.saveAlertInstance(&cmd)
					if err != nil {
						sch.log.Error("failed saving alert instance", "title", alertDefinition.Title, "key", key, "attempt", attempt, "now", ctx.now, "instance", r.Instance, "state", r.State.String(), "error", err)
					}
				}
				return nil
			}

			func() {
				evalRunning = true
				defer func() {
					evalRunning = false
					sch.evalApplied(key, ctx.now)
				}()

				for attempt = 0; attempt < sch.maxAttempts; attempt++ {
					err := evaluate(attempt)
					if err == nil {
						break
					}
				}
			}()
		case <-stopCh:
			sch.stopApplied(key)
			sch.log.Debug("stopping alert definition routine", "key", key)
			// interrupt evaluation if it's running
			return nil
		case <-grafanaCtx.Done():
			return grafanaCtx.Err()
		}
	}
}

type schedule struct {
	// base tick rate (fastest possible configured check)
	baseInterval time.Duration

	// each alert definition gets its own channel and routine
	registry alertDefinitionRegistry

	maxAttempts int64

	clock clock.Clock

	heartbeat *alerting.Ticker

	// evalApplied is only used for tests: test code can set it to non-nil
	// function, and then it'll be called from the event loop whenever the
	// message from evalApplied is handled.
	evalAppliedFunc func(alertDefinitionKey, time.Time)

	// stopApplied is only used for tests: test code can set it to non-nil
	// function, and then it'll be called from the event loop whenever the
	// message from stopApplied is handled.
	stopAppliedFunc func(alertDefinitionKey)

	log log.Logger

	evaluator eval.Evaluator

	store store
}

type schedulerCfg struct {
	c               clock.Clock
	baseInterval    time.Duration
	logger          log.Logger
	evalAppliedFunc func(alertDefinitionKey, time.Time)
	stopAppliedFunc func(alertDefinitionKey)
	evaluator       eval.Evaluator
	store           store
}

// newScheduler returns a new schedule.
func newScheduler(cfg schedulerCfg) *schedule {
	ticker := alerting.NewTicker(cfg.c.Now(), time.Second*0, cfg.c, int64(cfg.baseInterval.Seconds()))
	sch := schedule{
		registry:        alertDefinitionRegistry{alertDefinitionInfo: make(map[alertDefinitionKey]alertDefinitionInfo)},
		maxAttempts:     maxAttempts,
		clock:           cfg.c,
		baseInterval:    cfg.baseInterval,
		log:             cfg.logger,
		heartbeat:       ticker,
		evalAppliedFunc: cfg.evalAppliedFunc,
		stopAppliedFunc: cfg.stopAppliedFunc,
		evaluator:       cfg.evaluator,
		store:           cfg.store,
	}
	return &sch
}

func (sch *schedule) overrideCfg(cfg schedulerCfg) {
	sch.clock = cfg.c
	sch.baseInterval = cfg.baseInterval
	sch.heartbeat = alerting.NewTicker(cfg.c.Now(), time.Second*0, cfg.c, int64(cfg.baseInterval.Seconds()))
	sch.evalAppliedFunc = cfg.evalAppliedFunc
	sch.stopAppliedFunc = cfg.stopAppliedFunc
}

func (sch *schedule) evalApplied(alertDefKey alertDefinitionKey, now time.Time) {
	if sch.evalAppliedFunc == nil {
		return
	}

	sch.evalAppliedFunc(alertDefKey, now)
}

func (sch *schedule) stopApplied(alertDefKey alertDefinitionKey) {
	if sch.stopAppliedFunc == nil {
		return
	}

	sch.stopAppliedFunc(alertDefKey)
}

func (sch *schedule) Pause() error {
	if sch == nil {
		return fmt.Errorf("scheduler is not initialised")
	}
	sch.heartbeat.Pause()
	sch.log.Info("alert definition scheduler paused", "now", sch.clock.Now())
	return nil
}

func (sch *schedule) Unpause() error {
	if sch == nil {
		return fmt.Errorf("scheduler is not initialised")
	}
	sch.heartbeat.Unpause()
	sch.log.Info("alert definition scheduler unpaused", "now", sch.clock.Now())
	return nil
}

func (sch *schedule) Ticker(grafanaCtx context.Context) error {
	dispatcherGroup, ctx := errgroup.WithContext(grafanaCtx)
	for {
		select {
		case tick := <-sch.heartbeat.C:
			tickNum := tick.Unix() / int64(sch.baseInterval.Seconds())
			alertDefinitions := sch.fetchAllDetails(tick)
			sch.log.Debug("alert definitions fetched", "count", len(alertDefinitions))

			// registeredDefinitions is a map used for finding deleted alert definitions
			// initially it is assigned to all known alert definitions from the previous cycle
			// each alert definition found also in this cycle is removed
			// so, at the end, the remaining registered alert definitions are the deleted ones
			registeredDefinitions := sch.registry.keyMap()

			type readyToRunItem struct {
				key            alertDefinitionKey
				definitionInfo alertDefinitionInfo
			}
			readyToRun := make([]readyToRunItem, 0)
			for _, item := range alertDefinitions {
				if item.Paused {
					continue
				}

				key := item.getKey()
				itemVersion := item.Version
				newRoutine := !sch.registry.exists(key)
				definitionInfo := sch.registry.getOrCreateInfo(key, itemVersion)
				invalidInterval := item.IntervalSeconds%int64(sch.baseInterval.Seconds()) != 0

				if newRoutine && !invalidInterval {
					dispatcherGroup.Go(func() error {
						return sch.definitionRoutine(ctx, key, definitionInfo.evalCh, definitionInfo.stopCh)
					})
				}

				if invalidInterval {
					// this is expected to be always false
					// give that we validate interval during alert definition updates
					sch.log.Debug("alert definition with invalid interval will be ignored: interval should be divided exactly by scheduler interval", "key", key, "interval", time.Duration(item.IntervalSeconds)*time.Second, "scheduler interval", sch.baseInterval)
					continue
				}

				itemFrequency := item.IntervalSeconds / int64(sch.baseInterval.Seconds())
				if item.IntervalSeconds != 0 && tickNum%itemFrequency == 0 {
					readyToRun = append(readyToRun, readyToRunItem{key: key, definitionInfo: definitionInfo})
				}

				// remove the alert definition from the registered alert definitions
				delete(registeredDefinitions, key)
			}

			var step int64 = 0
			if len(readyToRun) > 0 {
				step = sch.baseInterval.Nanoseconds() / int64(len(readyToRun))
			}

			for i := range readyToRun {
				item := readyToRun[i]

				time.AfterFunc(time.Duration(int64(i)*step), func() {
					item.definitionInfo.evalCh <- &evalContext{now: tick, version: item.definitionInfo.version}
				})
			}

			// unregister and stop routines of the deleted alert definitions
			for key := range registeredDefinitions {
				definitionInfo, err := sch.registry.get(key)
				if err != nil {
					sch.log.Error("failed to get alert definition routine information", "err", err)
					continue
				}
				definitionInfo.stopCh <- struct{}{}
				sch.registry.del(key)
			}
		case <-grafanaCtx.Done():
			err := dispatcherGroup.Wait()
			return err
		}
	}
}

type alertDefinitionRegistry struct {
	mu                  sync.Mutex
	alertDefinitionInfo map[alertDefinitionKey]alertDefinitionInfo
}

// getOrCreateInfo returns the channel for the specific alert definition
// if it does not exists creates one and returns it
func (r *alertDefinitionRegistry) getOrCreateInfo(key alertDefinitionKey, definitionVersion int64) alertDefinitionInfo {
	r.mu.Lock()
	defer r.mu.Unlock()

	info, ok := r.alertDefinitionInfo[key]
	if !ok {
		r.alertDefinitionInfo[key] = alertDefinitionInfo{evalCh: make(chan *evalContext), stopCh: make(chan struct{}), version: definitionVersion}
		return r.alertDefinitionInfo[key]
	}
	info.version = definitionVersion
	r.alertDefinitionInfo[key] = info
	return info
}

// get returns the channel for the specific alert definition
// if the key does not exist returns an error
func (r *alertDefinitionRegistry) get(key alertDefinitionKey) (*alertDefinitionInfo, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	info, ok := r.alertDefinitionInfo[key]
	if !ok {
		return nil, fmt.Errorf("%v key not found", key)
	}
	return &info, nil
}

func (r *alertDefinitionRegistry) exists(key alertDefinitionKey) bool {
	r.mu.Lock()
	defer r.mu.Unlock()

	_, ok := r.alertDefinitionInfo[key]
	return ok
}

func (r *alertDefinitionRegistry) del(key alertDefinitionKey) {
	r.mu.Lock()
	defer r.mu.Unlock()

	delete(r.alertDefinitionInfo, key)
}

func (r *alertDefinitionRegistry) iter() <-chan alertDefinitionKey {
	c := make(chan alertDefinitionKey)

	f := func() {
		r.mu.Lock()
		defer r.mu.Unlock()

		for k := range r.alertDefinitionInfo {
			c <- k
		}
		close(c)
	}
	go f()

	return c
}

func (r *alertDefinitionRegistry) keyMap() map[alertDefinitionKey]struct{} {
	definitionsIDs := make(map[alertDefinitionKey]struct{})
	for k := range r.iter() {
		definitionsIDs[k] = struct{}{}
	}
	return definitionsIDs
}

type alertDefinitionInfo struct {
	evalCh  chan *evalContext
	stopCh  chan struct{}
	version int64
}

type evalContext struct {
	now     time.Time
	version int64
}
