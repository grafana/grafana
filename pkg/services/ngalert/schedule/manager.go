package schedule

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
)

// RulesStore is a store that provides alert rules for scheduling
type ManagerRuleStore interface {
	GetAlertRuleScheduleKeys(ctx context.Context) ([]models.AlertRuleScheduleKey, error)
	GetScheduleData(ctx context.Context, query store.GetScheduleDataQuery) (rules []*models.AlertRule, folders map[models.FolderKey]string, err error)
}

type GroupFactory interface {
	new(ctx context.Context, group *models.AlertRuleGroup, folderTitle string) *Group
}

type ManagerCfg struct {
	BaseInterval         time.Duration
	GroupFactory         GroupFactory
	RuleStore            ManagerRuleStore
	DisableGrafanaFolder bool
	Logger               log.Logger
	Metrics              *metrics.Scheduler
}

type Manager struct {
	ruleCache     ruleCache
	folderCache   folderCache
	groupRegistry groupCache

	ruleStore    ManagerRuleStore
	groupFactory GroupFactory

	baseInterval         time.Duration
	disableGrafanaFolder bool

	logger log.Logger
}

func NewManager(cfg ManagerCfg) *Manager {
	return &Manager{
		groupRegistry: newGroupReg(),
		ruleCache:     newRuleCache(),
		folderCache:   newFolderCache(),
		baseInterval:  cfg.BaseInterval,
		logger:        cfg.Logger,
		groupFactory:  cfg.GroupFactory,
		ruleStore:     cfg.RuleStore,
	}
}

func (m *Manager) Run(ctx context.Context) error {
	m.logger.Info("Starting rule manager")

	t := time.NewTicker(m.baseInterval)
	defer t.Stop()

	for {
		select {
		case <-t.C:
			// check for updates each baseInterval tick
			if err := m.update(ctx); err != nil {
				m.logger.Error("Failed to update groups", "error", err)
				return err
			}
		case <-ctx.Done():
			return nil
		}
	}
}

func (m *Manager) update(ctx context.Context) error {
	if ctx.Err() != nil {
		return nil
	}

	updated, groups, err := m.loadGroups(ctx)
	if err != nil {
		return err
	}
	if !updated {
		return nil
	}

	wg := sync.WaitGroup{}
	for _, newGroup := range groups {
		key := newGroup.groupKey

		oldGroup, ok := m.groupRegistry.get(key)
		m.groupRegistry.delete(key)

		// skip rescheduling if group is unchanged
		if ok && oldGroup.Equals(newGroup) {
			groups[key] = oldGroup
			continue
		}

		// stop old group and start new group
		wg.Add(1)
		go func(newGroup *Group) {
			if ok {
				oldGroup.Stop(errors.New("group updated"))
			}
			wg.Done()
			newGroup.Run()
		}(newGroup)

	}

	// stop all remaining groups
	rest := m.groupRegistry.all()
	wg.Add(len(rest))
	for _, group := range rest {
		go func(group *Group) {
			defer wg.Done()
			group.Stop(errors.New("group deleted"))
		}(group)
	}

	// wait for all groups to stop
	wg.Wait()

	// replace registry with currently running groups
	m.groupRegistry.replace(groups)

	return nil
}

func collectRules(rules []*models.AlertRule) map[models.AlertRuleGroupKey]*models.AlertRuleGroup {
	groupMap := make(map[models.AlertRuleGroupKey]*models.AlertRuleGroup)
	for _, rule := range rules {
		groupKey := models.AlertRuleGroupKey{
			OrgID:        rule.OrgID,
			RuleGroup:    rule.RuleGroup,
			NamespaceUID: rule.NamespaceUID,
		}
		group, ok := groupMap[groupKey]
		if !ok {
			group = &models.AlertRuleGroup{
				Title:     rule.RuleGroup,
				FolderUID: rule.NamespaceUID,
				Interval:  rule.IntervalSeconds,
			}
			groupMap[groupKey] = group
		}
		group.Rules = append(group.Rules, *rule)
	}

	return groupMap
}

func (m *Manager) loadGroups(ctx context.Context) (bool, map[models.AlertRuleGroupKey]*Group, error) {
	// unless the registry is empty, we can skip rescheduling if no rules have changed
	if !m.groupRegistry.empty() {
		ruleKeys, err := m.ruleStore.GetAlertRuleScheduleKeys(ctx)
		if err != nil {
			return false, nil, err
		}
		updated := m.ruleCache.update(ruleKeys)
		if !updated {
			return false, nil, nil
		}
	}

	// fetch all rules, and also current folder details
	rules, folders, err := m.ruleStore.GetScheduleData(ctx, store.GetScheduleDataQuery{
		PopulateFolders: !m.disableGrafanaFolder,
	})
	if err != nil {
		return false, nil, err
	}

	// update folder cache
	m.folderCache.replace(folders)

	// create schedule groups from database rules
	groups := collectRules(rules)
	groupMap := make(map[models.AlertRuleGroupKey]*Group)
	for key, group := range groups {
		fk := group.GetFolderKey()
		ft, ok := folders[fk]
		if !ok {
			m.logger.Error("Missing folder", "folder_key", fk)
			return false, nil, errors.New("folder key absent from store")
		}
		groupMap[key] = m.groupFactory.new(ctx, group, ft)
	}

	return true, groupMap, nil
}
