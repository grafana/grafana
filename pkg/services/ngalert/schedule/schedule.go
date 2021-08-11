package schedule

import (
	"context"
	"fmt"
	"net/url"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/alerting"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/sender"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/tsdb"

	"github.com/benbjohnson/clock"
	"golang.org/x/sync/errgroup"
)

// timeNow makes it possible to test usage of time
var timeNow = time.Now

// ScheduleService handles scheduling
type ScheduleService interface {
	Run(context.Context) error
	Pause() error
	Unpause() error
	AlertmanagersFor(orgID int64) []*url.URL
	DroppedAlertmanagersFor(orgID int64) []*url.URL

	// the following are used by tests only used for tests
	evalApplied(models.AlertRuleKey, time.Time)
	stopApplied(models.AlertRuleKey)
	overrideCfg(cfg SchedulerCfg)
}

// Notifier handles the delivery of alert notifications to the end user
type Notifier interface {
	PutAlerts(alerts apimodels.PostableAlerts) error
}

type schedule struct {
	// base tick rate (fastest possible configured check)
	baseInterval time.Duration

	// each alert rule gets its own channel and routine
	registry alertRuleRegistry

	maxAttempts int64

	clock clock.Clock

	heartbeat *alerting.Ticker

	// evalApplied is only used for tests: test code can set it to non-nil
	// function, and then it'll be called from the event loop whenever the
	// message from evalApplied is handled.
	evalAppliedFunc func(models.AlertRuleKey, time.Time)

	// stopApplied is only used for tests: test code can set it to non-nil
	// function, and then it'll be called from the event loop whenever the
	// message from stopApplied is handled.
	stopAppliedFunc func(models.AlertRuleKey)

	log log.Logger

	evaluator eval.Evaluator

	ruleStore        store.RuleStore
	instanceStore    store.InstanceStore
	adminConfigStore store.AdminConfigurationStore
	dataService      *tsdb.Service

	stateManager *state.Manager

	appURL string

	notifier Notifier
	metrics  *metrics.Metrics

	// Senders help us send alerts to external Alertmanagers.
	sendersMtx              sync.RWMutex
	sendersCfgHash          map[int64]string
	senders                 map[int64]*sender.Sender
	adminConfigPollInterval time.Duration
}

// SchedulerCfg is the scheduler configuration.
type SchedulerCfg struct {
	C                       clock.Clock
	BaseInterval            time.Duration
	Logger                  log.Logger
	EvalAppliedFunc         func(models.AlertRuleKey, time.Time)
	MaxAttempts             int64
	StopAppliedFunc         func(models.AlertRuleKey)
	Evaluator               eval.Evaluator
	RuleStore               store.RuleStore
	InstanceStore           store.InstanceStore
	AdminConfigStore        store.AdminConfigurationStore
	Notifier                Notifier
	Metrics                 *metrics.Metrics
	AdminConfigPollInterval time.Duration
}

// NewScheduler returns a new schedule.
func NewScheduler(cfg SchedulerCfg, dataService *tsdb.Service, appURL string, stateManager *state.Manager) *schedule {
	ticker := alerting.NewTicker(cfg.C.Now(), time.Second*0, cfg.C, int64(cfg.BaseInterval.Seconds()))
	sch := schedule{
		registry:                alertRuleRegistry{alertRuleInfo: make(map[models.AlertRuleKey]alertRuleInfo)},
		maxAttempts:             cfg.MaxAttempts,
		clock:                   cfg.C,
		baseInterval:            cfg.BaseInterval,
		log:                     cfg.Logger,
		heartbeat:               ticker,
		evalAppliedFunc:         cfg.EvalAppliedFunc,
		stopAppliedFunc:         cfg.StopAppliedFunc,
		evaluator:               cfg.Evaluator,
		ruleStore:               cfg.RuleStore,
		instanceStore:           cfg.InstanceStore,
		dataService:             dataService,
		adminConfigStore:        cfg.AdminConfigStore,
		notifier:                cfg.Notifier,
		metrics:                 cfg.Metrics,
		appURL:                  appURL,
		stateManager:            stateManager,
		senders:                 map[int64]*sender.Sender{},
		sendersCfgHash:          map[int64]string{},
		adminConfigPollInterval: cfg.AdminConfigPollInterval,
	}
	return &sch
}

func (sch *schedule) Pause() error {
	if sch == nil {
		return fmt.Errorf("scheduler is not initialised")
	}
	sch.heartbeat.Pause()
	sch.log.Info("alert rule scheduler paused", "now", sch.clock.Now())
	return nil
}

func (sch *schedule) Unpause() error {
	if sch == nil {
		return fmt.Errorf("scheduler is not initialised")
	}
	sch.heartbeat.Unpause()
	sch.log.Info("alert rule scheduler unpaused", "now", sch.clock.Now())
	return nil
}

func (sch *schedule) Run(ctx context.Context) error {
	var wg sync.WaitGroup
	wg.Add(2)

	go func() {
		defer wg.Done()
		if err := sch.ruleEvaluationLoop(ctx); err != nil {
			sch.log.Error("failure while running the rule evaluation loop", "err", err)
		}
	}()

	go func() {
		defer wg.Done()
		if err := sch.adminConfigSync(ctx); err != nil {
			sch.log.Error("failure while running the admin configuration sync", "err", err)
		}
	}()

	wg.Wait()
	return nil
}

// SyncAndApplyConfigFromDatabase looks for the admin configuration in the database and adjusts the sender(s) accordingly.
func (sch *schedule) SyncAndApplyConfigFromDatabase() error {
	sch.log.Debug("start of admin configuration sync")
	cfgs, err := sch.adminConfigStore.GetAdminConfigurations()
	if err != nil {
		return err
	}

	sch.log.Debug("found admin configurations", "count", len(cfgs))

	orgsFound := make(map[int64]struct{}, len(cfgs))
	sch.sendersMtx.Lock()
	for _, cfg := range cfgs {
		orgsFound[cfg.OrgID] = struct{}{} // keep track of the which senders we need to keep.

		existing, ok := sch.senders[cfg.OrgID]

		// If the tenant has no Alertmanager(s) configured and no running sender no-op.
		if !ok && len(cfg.Alertmanagers) == 0 {
			sch.log.Debug("no external alertmanagers configured", "org", cfg.OrgID)
			continue
		}

		// We have a running sender but no Alertmanager(s) configured, shut it down.
		if ok && len(cfg.Alertmanagers) == 0 {
			sch.log.Debug("no external alertmanager(s) configured, sender will be stopped", "org", cfg.OrgID)
			delete(orgsFound, cfg.OrgID)
			continue
		}

		// We have a running sender, check if we need to apply a new config.
		if ok {
			if sch.sendersCfgHash[cfg.OrgID] == cfg.AsSHA256() {
				sch.log.Debug("sender configuration is the same as the one running, no-op", "org", cfg.OrgID, "alertmanagers", cfg.Alertmanagers)
				continue
			}

			sch.log.Debug("applying new configuration to sender", "org", cfg.OrgID, "alertmanagers", cfg.Alertmanagers)
			err := existing.ApplyConfig(cfg)
			if err != nil {
				sch.log.Error("failed to apply configuration", "err", err, "org", cfg.OrgID)
				continue
			}
			sch.sendersCfgHash[cfg.OrgID] = cfg.AsSHA256()
			continue
		}

		// No sender and have Alertmanager(s) to send to - start a new one.
		sch.log.Info("creating new sender for the external alertmanagers", "org", cfg.OrgID, "alertmanagers", cfg.Alertmanagers)
		s, err := sender.New(sch.metrics)
		if err != nil {
			sch.log.Error("unable to start the sender", "err", err, "org", cfg.OrgID)
			continue
		}

		sch.senders[cfg.OrgID] = s
		s.Run()

		err = s.ApplyConfig(cfg)
		if err != nil {
			sch.log.Error("failed to apply configuration", "err", err, "org", cfg.OrgID)
			continue
		}

		sch.sendersCfgHash[cfg.OrgID] = cfg.AsSHA256()
	}

	sendersToStop := map[int64]*sender.Sender{}

	for orgID, s := range sch.senders {
		if _, exists := orgsFound[orgID]; !exists {
			sendersToStop[orgID] = s
			delete(sch.senders, orgID)
			delete(sch.sendersCfgHash, orgID)
		}
	}
	sch.sendersMtx.Unlock()

	// We can now stop these senders w/o having to hold a lock.
	for orgID, s := range sendersToStop {
		sch.log.Info("stopping sender", "org", orgID)
		s.Stop()
		sch.log.Info("stopped sender", "org", orgID)
	}

	sch.log.Debug("finish of admin configuration sync")

	return nil
}

// AlertmanagersFor returns all the discovered Alertmanager(s) for a particular organization.
func (sch *schedule) AlertmanagersFor(orgID int64) []*url.URL {
	sch.sendersMtx.RLock()
	defer sch.sendersMtx.RUnlock()
	s, ok := sch.senders[orgID]
	if !ok {
		return []*url.URL{}
	}

	return s.Alertmanagers()
}

// DroppedAlertmanagersFor returns all the dropped Alertmanager(s) for a particular organization.
func (sch *schedule) DroppedAlertmanagersFor(orgID int64) []*url.URL {
	sch.sendersMtx.RLock()
	defer sch.sendersMtx.RUnlock()
	s, ok := sch.senders[orgID]
	if !ok {
		return []*url.URL{}
	}

	return s.DroppedAlertmanagers()
}

func (sch *schedule) adminConfigSync(ctx context.Context) error {
	for {
		select {
		case <-time.After(sch.adminConfigPollInterval):
			if err := sch.SyncAndApplyConfigFromDatabase(); err != nil {
				sch.log.Error("unable to sync admin configuration", "err", err)
			}
		case <-ctx.Done():
			// Stop sending alerts to all external Alertmanager(s).
			sch.sendersMtx.Lock()
			for orgID, s := range sch.senders {
				delete(sch.senders, orgID) // delete before we stop to make sure we don't accept any more alerts.
				s.Stop()
			}
			sch.sendersMtx.Unlock()

			return nil
		}
	}
}

func (sch *schedule) ruleEvaluationLoop(ctx context.Context) error {
	dispatcherGroup, ctx := errgroup.WithContext(ctx)
	for {
		select {
		case tick := <-sch.heartbeat.C:
			tickNum := tick.Unix() / int64(sch.baseInterval.Seconds())
			alertRules := sch.fetchAllDetails()
			sch.log.Debug("alert rules fetched", "count", len(alertRules))

			// registeredDefinitions is a map used for finding deleted alert rules
			// initially it is assigned to all known alert rules from the previous cycle
			// each alert rule found also in this cycle is removed
			// so, at the end, the remaining registered alert rules are the deleted ones
			registeredDefinitions := sch.registry.keyMap()

			type readyToRunItem struct {
				key      models.AlertRuleKey
				ruleInfo alertRuleInfo
			}

			readyToRun := make([]readyToRunItem, 0)
			for _, item := range alertRules {
				key := item.GetKey()
				itemVersion := item.Version
				newRoutine := !sch.registry.exists(key)
				ruleInfo := sch.registry.getOrCreateInfo(key, itemVersion)
				invalidInterval := item.IntervalSeconds%int64(sch.baseInterval.Seconds()) != 0

				if newRoutine && !invalidInterval {
					dispatcherGroup.Go(func() error {
						return sch.ruleRoutine(ctx, key, ruleInfo.evalCh, ruleInfo.stopCh)
					})
				}

				if invalidInterval {
					// this is expected to be always false
					// give that we validate interval during alert rule updates
					sch.log.Debug("alert rule with invalid interval will be ignored: interval should be divided exactly by scheduler interval", "key", key, "interval", time.Duration(item.IntervalSeconds)*time.Second, "scheduler interval", sch.baseInterval)
					continue
				}

				itemFrequency := item.IntervalSeconds / int64(sch.baseInterval.Seconds())
				if item.IntervalSeconds != 0 && tickNum%itemFrequency == 0 {
					readyToRun = append(readyToRun, readyToRunItem{key: key, ruleInfo: ruleInfo})
				}

				// remove the alert rule from the registered alert rules
				delete(registeredDefinitions, key)
			}

			var step int64 = 0
			if len(readyToRun) > 0 {
				step = sch.baseInterval.Nanoseconds() / int64(len(readyToRun))
			}

			for i := range readyToRun {
				item := readyToRun[i]

				time.AfterFunc(time.Duration(int64(i)*step), func() {
					item.ruleInfo.evalCh <- &evalContext{now: tick, version: item.ruleInfo.version}
				})
			}

			// unregister and stop routines of the deleted alert rules
			for key := range registeredDefinitions {
				ruleInfo, err := sch.registry.get(key)
				if err != nil {
					sch.log.Error("failed to get alert rule routine information", "err", err)
					continue
				}
				ruleInfo.stopCh <- struct{}{}
				sch.registry.del(key)
			}
		case <-ctx.Done():
			waitErr := dispatcherGroup.Wait()

			orgIds, err := sch.instanceStore.FetchOrgIds()
			if err != nil {
				sch.log.Error("unable to fetch orgIds", "msg", err.Error())
			}

			for _, v := range orgIds {
				sch.saveAlertStates(sch.stateManager.GetAll(v))
			}

			sch.stateManager.Close()
			return waitErr
		}
	}
}

func (sch *schedule) ruleRoutine(grafanaCtx context.Context, key models.AlertRuleKey, evalCh <-chan *evalContext, stopCh <-chan struct{}) error {
	sch.log.Debug("alert rule routine started", "key", key)

	evalRunning := false
	var attempt int64
	var alertRule *models.AlertRule
	for {
		select {
		case ctx := <-evalCh:
			if evalRunning {
				continue
			}

			evaluate := func(attempt int64) error {
				start := timeNow()

				// fetch latest alert rule version
				if alertRule == nil || alertRule.Version < ctx.version {
					q := models.GetAlertRuleByUIDQuery{OrgID: key.OrgID, UID: key.UID}
					err := sch.ruleStore.GetAlertRuleByUID(&q)
					if err != nil {
						sch.log.Error("failed to fetch alert rule", "key", key)
						return err
					}
					alertRule = q.Result
					sch.log.Debug("new alert rule version fetched", "title", alertRule.Title, "key", key, "version", alertRule.Version)
				}

				condition := models.Condition{
					Condition: alertRule.Condition,
					OrgID:     alertRule.OrgID,
					Data:      alertRule.Data,
				}
				results, err := sch.evaluator.ConditionEval(&condition, ctx.now, sch.dataService)
				var (
					end    = timeNow()
					tenant = fmt.Sprint(alertRule.OrgID)
					dur    = end.Sub(start).Seconds()
				)

				sch.metrics.EvalTotal.WithLabelValues(tenant).Inc()
				sch.metrics.EvalDuration.WithLabelValues(tenant).Observe(dur)
				if err != nil {
					sch.metrics.EvalFailures.WithLabelValues(tenant).Inc()
					// consider saving alert instance on error
					sch.log.Error("failed to evaluate alert rule", "title", alertRule.Title,
						"key", key, "attempt", attempt, "now", ctx.now, "duration", end.Sub(start), "error", err)
					return err
				}

				processedStates := sch.stateManager.ProcessEvalResults(alertRule, results)
				sch.saveAlertStates(processedStates)
				alerts := FromAlertStateToPostableAlerts(sch.log, processedStates, sch.stateManager, sch.appURL)
				sch.log.Debug("sending alerts to notifier", "count", len(alerts.PostableAlerts), "alerts", alerts.PostableAlerts)
				err = sch.notifier.PutAlerts(alerts)
				if err != nil {
					sch.log.Error("failed to put alerts in the notifier", "count", len(alerts.PostableAlerts), "err", err)
				}

				// Send alerts to external Alertmanager(s) if we have a sender for this organization.
				sch.sendersMtx.RLock()
				defer sch.sendersMtx.RUnlock()
				s, ok := sch.senders[alertRule.OrgID]
				if ok {
					s.SendAlerts(alerts)
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
			sch.log.Debug("stopping alert rule routine", "key", key)
			// interrupt evaluation if it's running
			return nil
		case <-grafanaCtx.Done():
			return grafanaCtx.Err()
		}
	}
}

func (sch *schedule) saveAlertStates(states []*state.State) {
	sch.log.Debug("saving alert states", "count", len(states))
	for _, s := range states {
		cmd := models.SaveAlertInstanceCommand{
			RuleOrgID:         s.OrgID,
			RuleUID:           s.AlertRuleUID,
			Labels:            models.InstanceLabels(s.Labels),
			State:             models.InstanceStateType(s.State.String()),
			LastEvalTime:      s.LastEvaluationTime,
			CurrentStateSince: s.StartsAt,
			CurrentStateEnd:   s.EndsAt,
		}
		err := sch.instanceStore.SaveAlertInstance(&cmd)
		if err != nil {
			sch.log.Error("failed to save alert state", "uid", s.AlertRuleUID, "orgId", s.OrgID, "labels", s.Labels.String(), "state", s.State.String(), "msg", err.Error())
		}
	}
}

type alertRuleRegistry struct {
	mu            sync.Mutex
	alertRuleInfo map[models.AlertRuleKey]alertRuleInfo
}

// getOrCreateInfo returns the channel for the specific alert rule
// if it does not exists creates one and returns it
func (r *alertRuleRegistry) getOrCreateInfo(key models.AlertRuleKey, ruleVersion int64) alertRuleInfo {
	r.mu.Lock()
	defer r.mu.Unlock()

	info, ok := r.alertRuleInfo[key]
	if !ok {
		r.alertRuleInfo[key] = alertRuleInfo{evalCh: make(chan *evalContext), stopCh: make(chan struct{}), version: ruleVersion}
		return r.alertRuleInfo[key]
	}
	info.version = ruleVersion
	r.alertRuleInfo[key] = info
	return info
}

// get returns the channel for the specific alert rule
// if the key does not exist returns an error
func (r *alertRuleRegistry) get(key models.AlertRuleKey) (*alertRuleInfo, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	info, ok := r.alertRuleInfo[key]
	if !ok {
		return nil, fmt.Errorf("%v key not found", key)
	}
	return &info, nil
}

func (r *alertRuleRegistry) exists(key models.AlertRuleKey) bool {
	r.mu.Lock()
	defer r.mu.Unlock()

	_, ok := r.alertRuleInfo[key]
	return ok
}

func (r *alertRuleRegistry) del(key models.AlertRuleKey) {
	r.mu.Lock()
	defer r.mu.Unlock()

	delete(r.alertRuleInfo, key)
}

func (r *alertRuleRegistry) iter() <-chan models.AlertRuleKey {
	c := make(chan models.AlertRuleKey)

	f := func() {
		r.mu.Lock()
		defer r.mu.Unlock()

		for k := range r.alertRuleInfo {
			c <- k
		}
		close(c)
	}
	go f()

	return c
}

func (r *alertRuleRegistry) keyMap() map[models.AlertRuleKey]struct{} {
	definitionsIDs := make(map[models.AlertRuleKey]struct{})
	for k := range r.iter() {
		definitionsIDs[k] = struct{}{}
	}
	return definitionsIDs
}

type alertRuleInfo struct {
	evalCh  chan *evalContext
	stopCh  chan struct{}
	version int64
}

type evalContext struct {
	now     time.Time
	version int64
}

// overrideCfg is only used on tests.
func (sch *schedule) overrideCfg(cfg SchedulerCfg) {
	sch.clock = cfg.C
	sch.baseInterval = cfg.BaseInterval
	sch.heartbeat = alerting.NewTicker(cfg.C.Now(), time.Second*0, cfg.C, int64(cfg.BaseInterval.Seconds()))
	sch.evalAppliedFunc = cfg.EvalAppliedFunc
	sch.stopAppliedFunc = cfg.StopAppliedFunc
}

// evalApplied is only used on tests.
func (sch *schedule) evalApplied(alertDefKey models.AlertRuleKey, now time.Time) {
	if sch.evalAppliedFunc == nil {
		return
	}

	sch.evalAppliedFunc(alertDefKey, now)
}

// stopApplied is only used on tests.
func (sch *schedule) stopApplied(alertDefKey models.AlertRuleKey) {
	if sch.stopAppliedFunc == nil {
		return
	}

	sch.stopAppliedFunc(alertDefKey)
}
