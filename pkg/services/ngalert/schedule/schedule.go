package schedule

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/events"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/ngalert/sender"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	"github.com/grafana/grafana/pkg/services/ngalert/store"

	"github.com/benbjohnson/clock"
	"golang.org/x/sync/errgroup"
)

// ScheduleService is an interface for a service that schedules the evaluation
// of alert rules.
//go:generate mockery --name ScheduleService --structname FakeScheduleService --inpackage --filename schedule_mock.go
type ScheduleService interface {
	// Run the scheduler until the context is canceled or the scheduler returns
	// an error. The scheduler is terminated when this function returns.
	Run(context.Context) error

	// AlertmanagersFor returns all the discovered Alertmanager URLs for the
	// organization.
	AlertmanagersFor(orgID int64) []*url.URL

	// DroppedAlertmanagersFor returns all the dropped Alertmanager URLs for the
	// organization.
	DroppedAlertmanagersFor(orgID int64) []*url.URL
	// UpdateAlertRule notifies scheduler that a rule has been changed
	UpdateAlertRule(key ngmodels.AlertRuleKey)
	// UpdateAlertRulesByNamespaceUID notifies scheduler that all rules in a namespace should be updated.
	UpdateAlertRulesByNamespaceUID(ctx context.Context, orgID int64, uid string) error
	// DeleteAlertRule notifies scheduler that a rule has been changed
	DeleteAlertRule(key ngmodels.AlertRuleKey)
	// the following are used by tests only used for tests
	evalApplied(ngmodels.AlertRuleKey, time.Time)
	stopApplied(ngmodels.AlertRuleKey)
	overrideCfg(cfg SchedulerCfg)

	folderUpdateHandler(ctx context.Context, evt *events.FolderUpdated) error
}

type schedule struct {
	// base tick rate (fastest possible configured check)
	baseInterval time.Duration

	// each alert rule gets its own channel and routine
	registry alertRuleInfoRegistry

	maxAttempts int64

	clock clock.Clock

	ticker *alerting.Ticker

	// evalApplied is only used for tests: test code can set it to non-nil
	// function, and then it'll be called from the event loop whenever the
	// message from evalApplied is handled.
	evalAppliedFunc func(ngmodels.AlertRuleKey, time.Time)

	// stopApplied is only used for tests: test code can set it to non-nil
	// function, and then it'll be called from the event loop whenever the
	// message from stopApplied is handled.
	stopAppliedFunc func(ngmodels.AlertRuleKey)

	log log.Logger

	evaluator eval.Evaluator

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
	sendAlertsTo            map[int64]ngmodels.AlertmanagersChoice
	sendersCfgHash          map[int64]string
	senders                 map[int64]*sender.Sender
	adminConfigPollInterval time.Duration
	disabledOrgs            map[int64]struct{}
	minRuleInterval         time.Duration

	// schedulableAlertRules contains the alert rules that are considered for
	// evaluation in the current tick. The evaluation of an alert rule in the
	// current tick depends on its evaluation interval and when it was
	// last evaluated.
	schedulableAlertRules schedulableAlertRulesRegistry

	// bus is used to hook into events that should cause rule updates.
	bus bus.Bus
}

// SchedulerCfg is the scheduler configuration.
type SchedulerCfg struct {
	C                       clock.Clock
	BaseInterval            time.Duration
	Logger                  log.Logger
	EvalAppliedFunc         func(ngmodels.AlertRuleKey, time.Time)
	MaxAttempts             int64
	StopAppliedFunc         func(ngmodels.AlertRuleKey)
	Evaluator               eval.Evaluator
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
func NewScheduler(cfg SchedulerCfg, expressionService *expr.Service, appURL *url.URL, stateManager *state.Manager, bus bus.Bus) *schedule {
	ticker := alerting.NewTicker(cfg.C, cfg.BaseInterval, cfg.Metrics.Ticker)

	sch := schedule{
		registry:                alertRuleInfoRegistry{alertRuleInfo: make(map[ngmodels.AlertRuleKey]*alertRuleInfo)},
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
		sendAlertsTo:            map[int64]ngmodels.AlertmanagersChoice{},
		senders:                 map[int64]*sender.Sender{},
		sendersCfgHash:          map[int64]string{},
		adminConfigPollInterval: cfg.AdminConfigPollInterval,
		disabledOrgs:            cfg.DisabledOrgs,
		minRuleInterval:         cfg.MinRuleInterval,
		schedulableAlertRules:   schedulableAlertRulesRegistry{rules: make(map[ngmodels.AlertRuleKey]*ngmodels.SchedulableAlertRule)},
		bus:                     bus,
	}

	bus.AddEventListener(sch.folderUpdateHandler)

	return &sch
}

func (sch *schedule) Run(ctx context.Context) error {
	var wg sync.WaitGroup
	wg.Add(2)

	defer sch.ticker.Stop()

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
		if !ok && cfg.SendAlertsTo == ngmodels.InternalAlertmanager {
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
func (sch *schedule) UpdateAlertRule(key ngmodels.AlertRuleKey) {
	ruleInfo, err := sch.registry.get(key)
	if err != nil {
		return
	}
	ruleInfo.update()
}

// UpdateAlertRulesByNamespaceUID looks for the active rule evaluation for every rule in the given namespace and commands it to update the rule.
func (sch *schedule) UpdateAlertRulesByNamespaceUID(ctx context.Context, orgID int64, uid string) error {
	q := ngmodels.ListAlertRulesQuery{
		OrgID:         orgID,
		NamespaceUIDs: []string{uid},
	}
	if err := sch.ruleStore.ListAlertRules(ctx, &q); err != nil {
		return err
	}

	for _, r := range q.Result {
		sch.UpdateAlertRule(ngmodels.AlertRuleKey{
			OrgID: orgID,
			UID:   r.UID,
		})
	}

	return nil
}

// DeleteAlertRule stops evaluation of the rule, deletes it from active rules, and cleans up state cache.
func (sch *schedule) DeleteAlertRule(key ngmodels.AlertRuleKey) {
	// It can happen that the scheduler has deleted the alert rule before the
	// Ruler API has called DeleteAlertRule. This can happen as requests to
	// the Ruler API do not hold an exclusive lock over all scheduler operations.
	if _, ok := sch.schedulableAlertRules.del(key); !ok {
		sch.log.Info("alert rule cannot be removed from the scheduler as it is not scheduled", "uid", key.UID, "org_id", key.OrgID)
	}

	// Delete the rule routine
	ruleInfo, ok := sch.registry.del(key)
	if !ok {
		sch.log.Info("alert rule cannot be stopped as it is not running", "uid", key.UID, "org_id", key.OrgID)
		return
	}
	// stop rule evaluation
	ruleInfo.stop()

	// Our best bet at this point is that we update the metrics with what we hope to schedule in the next tick.
	alertRules := sch.schedulableAlertRules.all()
	sch.metrics.SchedulableAlertRules.Set(float64(len(alertRules)))
	sch.metrics.SchedulableAlertRulesHash.Set(float64(hashUIDs(alertRules)))
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
			// This is required as ticks from the ticker and time.Now() can have
			// a monotonic clock that when subtracted do not represent the delta
			// in wall clock time.
			start := time.Now().Round(0)
			sch.metrics.BehindSeconds.Set(start.Sub(tick).Seconds())

			tickNum := tick.Unix() / int64(sch.baseInterval.Seconds())
			disabledOrgs := make([]int64, 0, len(sch.disabledOrgs))
			for disabledOrg := range sch.disabledOrgs {
				disabledOrgs = append(disabledOrgs, disabledOrg)
			}

			if err := sch.updateSchedulableAlertRules(ctx, disabledOrgs); err != nil {
				sch.log.Error("scheduler failed to update alert rules", "err", err)
			}
			alertRules := sch.schedulableAlertRules.all()

			sch.log.Debug("alert rules fetched", "count", len(alertRules), "disabled_orgs", disabledOrgs)

			// registeredDefinitions is a map used for finding deleted alert rules
			// initially it is assigned to all known alert rules from the previous cycle
			// each alert rule found also in this cycle is removed
			// so, at the end, the remaining registered alert rules are the deleted ones
			registeredDefinitions := sch.registry.keyMap()

			// While these are the rules that we iterate over, at the moment there's no 100% guarantee that they'll be
			// scheduled as rules could be removed before we get a chance to evaluate them.
			sch.metrics.SchedulableAlertRules.Set(float64(len(alertRules)))
			sch.metrics.SchedulableAlertRulesHash.Set(float64(hashUIDs(alertRules)))

			type readyToRunItem struct {
				key      ngmodels.AlertRuleKey
				ruleName string
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
					readyToRun = append(readyToRun, readyToRunItem{key: key, ruleName: item.Title, ruleInfo: ruleInfo, version: itemVersion})
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
					success, dropped := item.ruleInfo.eval(tick, item.version)
					if !success {
						sch.log.Debug("scheduled evaluation was canceled because evaluation routine was stopped", "uid", item.key.UID, "org", item.key.OrgID, "time", tick)
						return
					}
					if dropped != nil {
						sch.log.Warn("Alert rule evaluation is too slow - dropped tick", "uid", item.key.UID, "org", item.key.OrgID, "time", tick)
						orgID := fmt.Sprint(item.key.OrgID)
						sch.metrics.EvaluationMissed.WithLabelValues(orgID, item.ruleName).Inc()
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

//nolint: gocyclo
func (sch *schedule) ruleRoutine(grafanaCtx context.Context, key ngmodels.AlertRuleKey, evalCh <-chan *evaluation, updateCh <-chan struct{}) error {
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
		if sch.sendAlertsTo[key.OrgID] == ngmodels.ExternalAlertmanagers && len(sch.AlertmanagersFor(key.OrgID)) > 0 {
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
		if ok && sch.sendAlertsTo[key.OrgID] != ngmodels.InternalAlertmanager {
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

	updateRule := func(ctx context.Context, oldRule *ngmodels.AlertRule) (*ngmodels.AlertRule, error) {
		q := ngmodels.GetAlertRuleByUIDQuery{OrgID: key.OrgID, UID: key.UID}
		err := sch.ruleStore.GetAlertRuleByUID(ctx, &q)
		if err != nil {
			logger.Error("failed to fetch alert rule", "err", err)
			return nil, err
		}
		if oldRule != nil && oldRule.Version < q.Result.Version {
			clearState()
		}

		user := &models.SignedInUser{
			UserId:  0,
			OrgRole: models.ROLE_ADMIN,
			OrgId:   key.OrgID,
		}

		folder, err := sch.ruleStore.GetNamespaceByUID(ctx, q.Result.NamespaceUID, q.Result.OrgID, user)
		if err != nil {
			logger.Error("failed to fetch alert rule namespace", "err", err)
			return nil, err
		}

		if q.Result.Labels == nil {
			q.Result.Labels = make(map[string]string)
		} else if val, ok := q.Result.Labels[ngmodels.FolderTitleLabel]; ok {
			logger.Warn("alert rule contains protected label, value will be overwritten", "label", ngmodels.FolderTitleLabel, "value", val)
		}
		q.Result.Labels[ngmodels.FolderTitleLabel] = folder.Title

		return q.Result, nil
	}

	evaluate := func(ctx context.Context, r *ngmodels.AlertRule, attempt int64, e *evaluation) error {
		logger := logger.New("version", r.Version, "attempt", attempt, "now", e.scheduledAt)
		start := sch.clock.Now()

		condition := ngmodels.Condition{
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
	var currentRule *ngmodels.AlertRule
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
				logger.Error("updating rule failed after all retries", "err", err)
			}
		// evalCh - used by the scheduler to signal that evaluation is needed.
		case ctx, ok := <-evalCh:
			if !ok {
				logger.Debug("evaluation channel has been closed. Exiting")
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
		cmd := ngmodels.SaveAlertInstanceCommand{
			RuleOrgID:         s.OrgID,
			RuleUID:           s.AlertRuleUID,
			Labels:            ngmodels.InstanceLabels(s.Labels),
			State:             ngmodels.InstanceStateType(s.State.String()),
			StateReason:       s.StateReason,
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

// folderUpdateHandler listens for folder update events and updates all rules in the given folder.
func (sch *schedule) folderUpdateHandler(ctx context.Context, evt *events.FolderUpdated) error {
	return sch.UpdateAlertRulesByNamespaceUID(ctx, evt.OrgID, evt.UID)
}

// overrideCfg is only used on tests.
func (sch *schedule) overrideCfg(cfg SchedulerCfg) {
	sch.clock = cfg.C
	sch.baseInterval = cfg.BaseInterval
	sch.ticker.Stop()
	sch.ticker = alerting.NewTicker(cfg.C, cfg.BaseInterval, cfg.Metrics.Ticker)
	sch.evalAppliedFunc = cfg.EvalAppliedFunc
	sch.stopAppliedFunc = cfg.StopAppliedFunc
}

// evalApplied is only used on tests.
func (sch *schedule) evalApplied(alertDefKey ngmodels.AlertRuleKey, now time.Time) {
	if sch.evalAppliedFunc == nil {
		return
	}

	sch.evalAppliedFunc(alertDefKey, now)
}

// stopApplied is only used on tests.
func (sch *schedule) stopApplied(alertDefKey ngmodels.AlertRuleKey) {
	if sch.stopAppliedFunc == nil {
		return
	}

	sch.stopAppliedFunc(alertDefKey)
}
