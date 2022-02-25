package schedule

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/ngalert/sender"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	"github.com/grafana/grafana/pkg/services/ngalert/store"

	"github.com/benbjohnson/clock"
	"golang.org/x/sync/errgroup"
)

// ScheduleService is an interface for a service that schedules the evaluation
// of alert rules.
type ScheduleService interface {
	// Run the scheduler until the context is canceled or the scheduler returns
	// an error. The scheduler is terminated when this function returns.
	Run(context.Context) error
	Pause() error
	Unpause() error

	// AlertmanagersFor returns all the discovered Alertmanager URLs for the
	// organization.
	AlertmanagersFor(orgID int64) []*url.URL

	// DroppedAlertmanagersFor returns all the dropped Alertmanager URLs for the
	// organization.
	DroppedAlertmanagersFor(orgID int64) []*url.URL
	// UpdateAlertRule notifies scheduler that a rule has been changed
	UpdateAlertRule(key models.AlertRuleKey)
	// DeleteAlertRule notifies scheduler that a rule has been changed
	DeleteAlertRule(key models.AlertRuleKey)
	// the following are used by tests only used for tests
	evalApplied(models.AlertRuleKey, time.Time)
	stopApplied(models.AlertRuleKey)
	overrideCfg(cfg SchedulerCfg)
}

type schedule struct {
	// base tick rate (fastest possible configured check)
	baseInterval time.Duration

	// each alert rule gets its own channel and routine
	registry alertRuleRegistry

	maxAttempts int64

	clock clock.Clock

	ticker *alerting.Ticker

	// evalApplied is only used for tests: test code can set it to non-nil
	// function, and then it'll be called from the event loop whenever the
	// message from evalApplied is handled.
	evalAppliedFunc func(models.AlertRuleKey, time.Time)

	// stopApplied is only used for tests: test code can set it to non-nil
	// function, and then it'll be called from the event loop whenever the
	// message from stopApplied is handled.
	stopAppliedFunc func(models.AlertRuleKey)

	log log.Logger

	evaluator *eval.Evaluator

	ruleStore         store.RuleStore
	instanceStore     store.InstanceStore
	adminConfigStore  store.AdminConfigurationStore
	orgStore          store.OrgStore
	expressionService *expr.Service

	stateManager *state.Manager

	appURL *url.URL

	multiOrgNotifier *notifier.MultiOrgAlertmanager
	metrics          *metrics.Scheduler

	// Senders help us send alerts to external Alertmanagers.
	adminConfigMtx          sync.RWMutex
	sendAlertsTo            map[int64]models.AlertmanagersChoice
	sendersCfgHash          map[int64]string
	senders                 map[int64]*sender.Sender
	adminConfigPollInterval time.Duration
	disabledOrgs            map[int64]struct{}
	minRuleInterval         time.Duration
}

// SchedulerCfg is the scheduler configuration.
type SchedulerCfg struct {
	C                       clock.Clock
	BaseInterval            time.Duration
	Logger                  log.Logger
	EvalAppliedFunc         func(models.AlertRuleKey, time.Time)
	MaxAttempts             int64
	StopAppliedFunc         func(models.AlertRuleKey)
	Evaluator               *eval.Evaluator
	RuleStore               store.RuleStore
	OrgStore                store.OrgStore
	InstanceStore           store.InstanceStore
	AdminConfigStore        store.AdminConfigurationStore
	MultiOrgNotifier        *notifier.MultiOrgAlertmanager
	Metrics                 *metrics.Scheduler
	AdminConfigPollInterval time.Duration
	DisabledOrgs            map[int64]struct{}
	MinRuleInterval         time.Duration
}

// NewScheduler returns a new schedule.
func NewScheduler(cfg SchedulerCfg, expressionService *expr.Service, appURL *url.URL, stateManager *state.Manager) *schedule {
	ticker := alerting.NewTicker(cfg.C.Now(), time.Second*0, cfg.C, int64(cfg.BaseInterval.Seconds()))

	sch := schedule{
		registry:                alertRuleRegistry{alertRuleInfo: make(map[models.AlertRuleKey]*alertRuleInfo)},
		maxAttempts:             cfg.MaxAttempts,
		clock:                   cfg.C,
		baseInterval:            cfg.BaseInterval,
		log:                     cfg.Logger,
		ticker:                  ticker,
		evalAppliedFunc:         cfg.EvalAppliedFunc,
		stopAppliedFunc:         cfg.StopAppliedFunc,
		evaluator:               cfg.Evaluator,
		ruleStore:               cfg.RuleStore,
		instanceStore:           cfg.InstanceStore,
		orgStore:                cfg.OrgStore,
		expressionService:       expressionService,
		adminConfigStore:        cfg.AdminConfigStore,
		multiOrgNotifier:        cfg.MultiOrgNotifier,
		metrics:                 cfg.Metrics,
		appURL:                  appURL,
		stateManager:            stateManager,
		sendAlertsTo:            map[int64]models.AlertmanagersChoice{},
		senders:                 map[int64]*sender.Sender{},
		sendersCfgHash:          map[int64]string{},
		adminConfigPollInterval: cfg.AdminConfigPollInterval,
		disabledOrgs:            cfg.DisabledOrgs,
		minRuleInterval:         cfg.MinRuleInterval,
	}
	return &sch
}

func (sch *schedule) Pause() error {
	if sch == nil {
		return fmt.Errorf("scheduler is not initialised")
	}
	sch.ticker.Pause()
	sch.log.Info("alert rule scheduler paused", "now", sch.clock.Now())
	return nil
}

func (sch *schedule) Unpause() error {
	if sch == nil {
		return fmt.Errorf("scheduler is not initialised")
	}
	sch.ticker.Unpause()
	sch.log.Info("alert rule scheduler unpaused", "now", sch.clock.Now())
	return nil
}

func (sch *schedule) Run(ctx context.Context) error {
	var wg sync.WaitGroup
	wg.Add(2)

	go func() {
		defer wg.Done()
		if err := sch.schedulePeriodic(ctx); err != nil {
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

// SyncAndApplyConfigFromDatabase looks for the admin configuration in the database
// and adjusts the sender(s) and alert handling mechanism accordingly.
func (sch *schedule) SyncAndApplyConfigFromDatabase() error {
	sch.log.Debug("start of admin configuration sync")
	cfgs, err := sch.adminConfigStore.GetAdminConfigurations()
	if err != nil {
		return err
	}

	sch.log.Debug("found admin configurations", "count", len(cfgs))

	orgsFound := make(map[int64]struct{}, len(cfgs))
	sch.adminConfigMtx.Lock()
	for _, cfg := range cfgs {
		_, isDisabledOrg := sch.disabledOrgs[cfg.OrgID]
		if isDisabledOrg {
			sch.log.Debug("skipping starting sender for disabled org", "org", cfg.OrgID)
			continue
		}

		// Update the Alertmanagers choice for the organization.
		sch.sendAlertsTo[cfg.OrgID] = cfg.SendAlertsTo

		orgsFound[cfg.OrgID] = struct{}{} // keep track of the which senders we need to keep.

		existing, ok := sch.senders[cfg.OrgID]

		// We have no running sender and no Alertmanager(s) configured, no-op.
		if !ok && len(cfg.Alertmanagers) == 0 {
			sch.log.Debug("no external alertmanagers configured", "org", cfg.OrgID)
			continue
		}
		//  We have no running sender and alerts are handled internally, no-op.
		if !ok && cfg.SendAlertsTo == models.InternalAlertmanager {
			sch.log.Debug("alerts are handled internally", "org", cfg.OrgID)
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
	sch.adminConfigMtx.Unlock()

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
	sch.adminConfigMtx.RLock()
	defer sch.adminConfigMtx.RUnlock()
	s, ok := sch.senders[orgID]
	if !ok {
		return []*url.URL{}
	}

	return s.Alertmanagers()
}

// DroppedAlertmanagersFor returns all the dropped Alertmanager(s) for a particular organization.
func (sch *schedule) DroppedAlertmanagersFor(orgID int64) []*url.URL {
	sch.adminConfigMtx.RLock()
	defer sch.adminConfigMtx.RUnlock()
	s, ok := sch.senders[orgID]
	if !ok {
		return []*url.URL{}
	}

	return s.DroppedAlertmanagers()
}

// UpdateAlertRule looks for the active rule evaluation and commands it to update the rule
func (sch *schedule) UpdateAlertRule(key models.AlertRuleKey) {
	ruleInfo, err := sch.registry.get(key)
	if err != nil {
		return
	}
	ruleInfo.update()
}

// DeleteAlertRule stops evaluation of the rule, deletes it from active rules, and cleans up state cache.
func (sch *schedule) DeleteAlertRule(key models.AlertRuleKey) {
	ruleInfo, ok := sch.registry.del(key)
	if !ok {
		sch.log.Info("unable to delete alert rule routine information by key", "uid", key.UID, "org_id", key.OrgID)
		return
	}
	// stop rule evaluation
	ruleInfo.stop()
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
			sch.adminConfigMtx.Lock()
			for orgID, s := range sch.senders {
				delete(sch.senders, orgID) // delete before we stop to make sure we don't accept any more alerts.
				s.Stop()
			}
			sch.adminConfigMtx.Unlock()

			return nil
		}
	}
}

func (sch *schedule) schedulePeriodic(ctx context.Context) error {
	dispatcherGroup, ctx := errgroup.WithContext(ctx)
	for {
		select {
		case tick := <-sch.ticker.C:
			// We use Round(0) on the start time to remove the monotonic clock.
			// This is required as late ticks from the ticker have current monotonic
			// timestamps such that start.Sub(tick) does not return the expected
			// delta.
			start := time.Now().Round(0)
			sch.metrics.BehindSeconds.Set(start.Sub(tick).Seconds())

			tickNum := tick.Unix() / int64(sch.baseInterval.Seconds())
			disabledOrgs := make([]int64, 0, len(sch.disabledOrgs))
			for disabledOrg := range sch.disabledOrgs {
				disabledOrgs = append(disabledOrgs, disabledOrg)
			}

			alertRules := sch.getAlertRules(ctx, disabledOrgs)
			sch.log.Debug("alert rules fetched", "count", len(alertRules), "disabled_orgs", disabledOrgs)

			// registeredDefinitions is a map used for finding deleted alert rules
			// initially it is assigned to all known alert rules from the previous cycle
			// each alert rule found also in this cycle is removed
			// so, at the end, the remaining registered alert rules are the deleted ones
			registeredDefinitions := sch.registry.keyMap()

			type readyToRunItem struct {
				key      models.AlertRuleKey
				ruleInfo *alertRuleInfo
				version  int64
			}

			readyToRun := make([]readyToRunItem, 0)
			for _, item := range alertRules {
				key := item.GetKey()
				itemVersion := item.Version
				ruleInfo, newRoutine := sch.registry.getOrCreateInfo(ctx, key)

				// enforce minimum evaluation interval
				if item.IntervalSeconds < int64(sch.minRuleInterval.Seconds()) {
					sch.log.Debug("interval adjusted", "rule_interval_seconds", item.IntervalSeconds, "min_interval_seconds", sch.minRuleInterval.Seconds(), "key", key)
					item.IntervalSeconds = int64(sch.minRuleInterval.Seconds())
				}

				invalidInterval := item.IntervalSeconds%int64(sch.baseInterval.Seconds()) != 0

				if newRoutine && !invalidInterval {
					dispatcherGroup.Go(func() error {
						return sch.ruleRoutine(ruleInfo.ctx, key, ruleInfo.evalCh, ruleInfo.updateCh)
					})
				}

				if invalidInterval {
					// this is expected to be always false
					// given that we validate interval during alert rule updates
					sch.log.Debug("alert rule with invalid interval will be ignored: interval should be divided exactly by scheduler interval", "key", key, "interval", time.Duration(item.IntervalSeconds)*time.Second, "scheduler interval", sch.baseInterval)
					continue
				}

				itemFrequency := item.IntervalSeconds / int64(sch.baseInterval.Seconds())
				if item.IntervalSeconds != 0 && tickNum%itemFrequency == 0 {
					readyToRun = append(readyToRun, readyToRunItem{key: key, ruleInfo: ruleInfo, version: itemVersion})
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
					success := item.ruleInfo.eval(tick, item.version)
					if !success {
						sch.log.Debug("Scheduled evaluation was canceled because evaluation routine was stopped", "uid", item.key.UID, "org", item.key.OrgID, "time", tick)
					}
				})
			}

			// unregister and stop routines of the deleted alert rules
			for key := range registeredDefinitions {
				sch.DeleteAlertRule(key)
			}

			sch.metrics.SchedulePeriodicDuration.Observe(time.Since(start).Seconds())
		case <-ctx.Done():
			waitErr := dispatcherGroup.Wait()

			orgIds, err := sch.instanceStore.FetchOrgIds(ctx)
			if err != nil {
				sch.log.Error("unable to fetch orgIds", "msg", err.Error())
			}

			for _, v := range orgIds {
				sch.saveAlertStates(ctx, sch.stateManager.GetAll(v))
			}

			sch.stateManager.Close()
			return waitErr
		}
	}
}

func (sch *schedule) ruleRoutine(grafanaCtx context.Context, key models.AlertRuleKey, evalCh <-chan *evaluation, updateCh <-chan struct{}) error {
	logger := sch.log.New("uid", key.UID, "org", key.OrgID)
	logger.Debug("alert rule routine started")

	orgID := fmt.Sprint(key.OrgID)
	evalTotal := sch.metrics.EvalTotal.WithLabelValues(orgID)
	evalDuration := sch.metrics.EvalDuration.WithLabelValues(orgID)
	evalTotalFailures := sch.metrics.EvalFailures.WithLabelValues(orgID)

	notify := func(alerts definitions.PostableAlerts, logger log.Logger) {
		if len(alerts.PostableAlerts) == 0 {
			logger.Debug("no alerts to put in the notifier or to send to external Alertmanager(s)")
			return
		}

		// Send alerts to local notifier if they need to be handled internally
		// or if no external AMs have been discovered yet.
		var localNotifierExist, externalNotifierExist bool
		if sch.sendAlertsTo[key.OrgID] == models.ExternalAlertmanagers && len(sch.AlertmanagersFor(key.OrgID)) > 0 {
			logger.Debug("no alerts to put in the notifier")
		} else {
			logger.Debug("sending alerts to local notifier", "count", len(alerts.PostableAlerts), "alerts", alerts.PostableAlerts)
			n, err := sch.multiOrgNotifier.AlertmanagerFor(key.OrgID)
			if err == nil {
				localNotifierExist = true
				if err := n.PutAlerts(alerts); err != nil {
					logger.Error("failed to put alerts in the local notifier", "count", len(alerts.PostableAlerts), "err", err)
				}
			} else {
				if errors.Is(err, notifier.ErrNoAlertmanagerForOrg) {
					logger.Debug("local notifier was not found")
				} else {
					logger.Error("local notifier is not available", "err", err)
				}
			}
		}

		// Send alerts to external Alertmanager(s) if we have a sender for this organization
		// and alerts are not being handled just internally.
		sch.adminConfigMtx.RLock()
		defer sch.adminConfigMtx.RUnlock()
		s, ok := sch.senders[key.OrgID]
		if ok && sch.sendAlertsTo[key.OrgID] != models.InternalAlertmanager {
			logger.Debug("sending alerts to external notifier", "count", len(alerts.PostableAlerts), "alerts", alerts.PostableAlerts)
			s.SendAlerts(alerts)
			externalNotifierExist = true
		}

		if !localNotifierExist && !externalNotifierExist {
			logger.Error("no external or internal notifier - alerts not delivered!", "count", len(alerts.PostableAlerts))
		}
	}

	clearState := func() {
		states := sch.stateManager.GetStatesForRuleUID(key.OrgID, key.UID)
		expiredAlerts := FromAlertsStateToStoppedAlert(states, sch.appURL, sch.clock)
		sch.stateManager.RemoveByRuleUID(key.OrgID, key.UID)
		notify(expiredAlerts, logger)
	}

	updateRule := func(ctx context.Context, oldRule *models.AlertRule) (*models.AlertRule, error) {
		q := models.GetAlertRuleByUIDQuery{OrgID: key.OrgID, UID: key.UID}
		err := sch.ruleStore.GetAlertRuleByUID(ctx, &q)
		if err != nil {
			logger.Error("failed to fetch alert rule", "err", err)
			return nil, err
		}
		if oldRule != nil && oldRule.Version < q.Result.Version {
			clearState()
		}
		return q.Result, nil
	}

	evaluate := func(ctx context.Context, r *models.AlertRule, attempt int64, e *evaluation) error {
		logger := logger.New("version", r.Version, "attempt", attempt, "now", e.scheduledAt)
		start := sch.clock.Now()

		condition := models.Condition{
			Condition: r.Condition,
			OrgID:     r.OrgID,
			Data:      r.Data,
		}
		results, err := sch.evaluator.ConditionEval(&condition, e.scheduledAt, sch.expressionService)
		dur := sch.clock.Now().Sub(start)
		evalTotal.Inc()
		evalDuration.Observe(dur.Seconds())
		if err != nil {
			evalTotalFailures.Inc()
			// consider saving alert instance on error
			logger.Error("failed to evaluate alert rule", "duration", dur, "err", err)
			return err
		}
		logger.Debug("alert rule evaluated", "results", results, "duration", dur)

		processedStates := sch.stateManager.ProcessEvalResults(ctx, r, results)
		sch.saveAlertStates(ctx, processedStates)
		alerts := FromAlertStateToPostableAlerts(processedStates, sch.stateManager, sch.appURL)

		notify(alerts, logger)
		return nil
	}

	retryIfError := func(f func(attempt int64) error) error {
		var attempt int64
		var err error
		for attempt = 0; attempt < sch.maxAttempts; attempt++ {
			err = f(attempt)
			if err == nil {
				return nil
			}
		}
		return err
	}

	evalRunning := false
	var currentRule *models.AlertRule
	defer sch.stopApplied(key)
	for {
		select {
		// used by external services (API) to notify that rule is updated.
		case <-updateCh:
			logger.Info("fetching new version of the rule")
			err := retryIfError(func(attempt int64) error {
				newRule, err := updateRule(grafanaCtx, currentRule)
				if err != nil {
					return err
				}
				logger.Debug("new alert rule version fetched", "title", newRule.Title, "version", newRule.Version)
				currentRule = newRule
				return nil
			})
			if err != nil {
				logger.Error("updating rule failed after all retries", "error", err)
			}
		// evalCh - used by the scheduler to signal that evaluation is needed.
		case ctx, ok := <-evalCh:
			if !ok {
				logger.Debug("Evaluation channel has been closed. Exiting")
				return nil
			}
			if evalRunning {
				continue
			}

			func() {
				evalRunning = true
				defer func() {
					evalRunning = false
					sch.evalApplied(key, ctx.scheduledAt)
				}()

				err := retryIfError(func(attempt int64) error {
					// fetch latest alert rule version
					if currentRule == nil || currentRule.Version < ctx.version {
						newRule, err := updateRule(grafanaCtx, currentRule)
						if err != nil {
							return err
						}
						currentRule = newRule
						logger.Debug("new alert rule version fetched", "title", newRule.Title, "version", newRule.Version)
					}
					return evaluate(grafanaCtx, currentRule, attempt, ctx)
				})
				if err != nil {
					logger.Error("evaluation failed after all retries", "err", err)
				}
			}()
		case <-grafanaCtx.Done():
			clearState()
			logger.Debug("stopping alert rule routine")
			return nil
		}
	}
}

func (sch *schedule) saveAlertStates(ctx context.Context, states []*state.State) {
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
		err := sch.instanceStore.SaveAlertInstance(ctx, &cmd)
		if err != nil {
			sch.log.Error("failed to save alert state", "uid", s.AlertRuleUID, "orgId", s.OrgID, "labels", s.Labels.String(), "state", s.State.String(), "msg", err.Error())
		}
	}
}

type alertRuleRegistry struct {
	mu            sync.Mutex
	alertRuleInfo map[models.AlertRuleKey]*alertRuleInfo
}

// getOrCreateInfo gets rule routine information from registry by the key. If it does not exist, it creates a new one.
// Returns a pointer to the rule routine information and a flag that indicates whether it is a new struct or not.
func (r *alertRuleRegistry) getOrCreateInfo(context context.Context, key models.AlertRuleKey) (*alertRuleInfo, bool) {
	r.mu.Lock()
	defer r.mu.Unlock()

	info, ok := r.alertRuleInfo[key]
	if !ok {
		info = newAlertRuleInfo(context)
		r.alertRuleInfo[key] = info
	}
	return info, !ok
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
	return info, nil
}

func (r *alertRuleRegistry) exists(key models.AlertRuleKey) bool {
	r.mu.Lock()
	defer r.mu.Unlock()

	_, ok := r.alertRuleInfo[key]
	return ok
}

// del removes pair that has specific key from alertRuleInfo.
// Returns 2-tuple where the first element is value of the removed pair
// and the second element indicates whether element with the specified key existed.
func (r *alertRuleRegistry) del(key models.AlertRuleKey) (*alertRuleInfo, bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	info, ok := r.alertRuleInfo[key]
	if ok {
		delete(r.alertRuleInfo, key)
	}
	return info, ok
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
	evalCh   chan *evaluation
	updateCh chan struct{}
	ctx      context.Context
	stop     context.CancelFunc
}

func newAlertRuleInfo(parent context.Context) *alertRuleInfo {
	ctx, cancel := context.WithCancel(parent)
	return &alertRuleInfo{evalCh: make(chan *evaluation), updateCh: make(chan struct{}), ctx: ctx, stop: cancel}
}

// eval signals the rule evaluation routine to perform the evaluation of the rule. Does nothing if the loop is stopped
func (a *alertRuleInfo) eval(t time.Time, version int64) bool {
	select {
	case a.evalCh <- &evaluation{
		scheduledAt: t,
		version:     version,
	}:
		return true
	case <-a.ctx.Done():
		return false
	}
}

// update signals the rule evaluation routine to update the internal state. Does nothing if the loop is stopped
func (a *alertRuleInfo) update() bool {
	select {
	case a.updateCh <- struct{}{}:
		return true
	case <-a.ctx.Done():
		return false
	}
}

type evaluation struct {
	scheduledAt time.Time
	version     int64
}

// overrideCfg is only used on tests.
func (sch *schedule) overrideCfg(cfg SchedulerCfg) {
	sch.clock = cfg.C
	sch.baseInterval = cfg.BaseInterval
	sch.ticker = alerting.NewTicker(cfg.C.Now(), time.Second*0, cfg.C, int64(cfg.BaseInterval.Seconds()))
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
