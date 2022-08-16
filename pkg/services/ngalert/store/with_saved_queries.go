package store

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/models"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/queries"
	"github.com/grafana/grafana/pkg/services/store"
	"github.com/grafana/grafana/pkg/services/user"
)

var ruleStore RuleStore = &storeWithSavedQueries{}

type storeWithSavedQueries struct {
	storage store.StorageService
	wrapped RuleStore
}

func (s storeWithSavedQueries) DeleteAlertRulesByUID(ctx context.Context, orgID int64, ruleUID ...string) error {
	return s.wrapped.DeleteAlertRulesByUID(ctx, orgID, ruleUID...)
}

func (s storeWithSavedQueries) DeleteAlertInstancesByRuleUID(ctx context.Context, orgID int64, ruleUID string) error {
	return s.DeleteAlertInstancesByRuleUID(ctx, orgID, ruleUID)
}

func (s storeWithSavedQueries) updateWithSavedQueries(ctx context.Context, alertRule *ngmodels.AlertRule) error {
	if alertRule == nil || alertRule.SavedQueryUID == "" {
		return nil
	}

	savedQueryRaw, err := s.storage.Read(ctx, store.QueriesSearch, alertRule.SavedQueryUID)
	if err != nil {
		return err
	}

	if savedQueryRaw != nil && savedQueryRaw.Contents != nil {
		return err
	}

	savedAlertingQueries, err := queries.DeserializeAsAlertingQueries(savedQueryRaw.Contents)
	if err != nil {
		return err
	}

	queriesByRefId := make(map[string]ngmodels.AlertQuery)
	for i, q := range alertRule.Data {
		queriesByRefId[q.RefID] = alertRule.Data[i]
	}

	for i := range savedAlertingQueries {
		if _, ok := queriesByRefId[savedAlertingQueries[i].RefID]; ok {
			savedAlertingQueries[i].RelativeTimeRange = queriesByRefId[savedAlertingQueries[i].RefID].RelativeTimeRange
		} else {
			// no relative time range - should not happen
		}
	}

	alertRule.Data = savedAlertingQueries

	return nil

}

func (s storeWithSavedQueries) GetAlertRuleByUID(ctx context.Context, query *ngmodels.GetAlertRuleByUIDQuery) error {
	fmt.Println("getting alert rule by uid")
	if err := s.wrapped.GetAlertRuleByUID(ctx, query); err != nil {
		return err
	}

	if err := s.updateWithSavedQueries(ctx, query.Result); err != nil {
		return err
	}

	return nil
}

func (s storeWithSavedQueries) GetAlertRulesGroupByRuleUID(ctx context.Context, query *ngmodels.GetAlertRulesGroupByRuleUIDQuery) error {
	if err := s.wrapped.GetAlertRulesGroupByRuleUID(ctx, query); err != nil {
		return err
	}

	for i := range query.Result {
		if err := s.updateWithSavedQueries(ctx, query.Result[i]); err != nil {
			return err
		}
	}
	return nil
}

func (s storeWithSavedQueries) GetAlertRulesForScheduling(ctx context.Context, query *ngmodels.GetAlertRulesForSchedulingQuery) error {
	if err := s.wrapped.GetAlertRulesForScheduling(ctx, query); err != nil {
		return err
	}

	for i := range query.Result {
		if err := s.updateWithSavedQueries(ctx, query.Result[i]); err != nil {
			return err
		}
	}
	return nil
}

func (s storeWithSavedQueries) ListAlertRules(ctx context.Context, query *ngmodels.ListAlertRulesQuery) error {
	if err := s.wrapped.ListAlertRules(ctx, query); err != nil {
		return err
	}
	for i := range query.Result {
		if err := s.updateWithSavedQueries(ctx, query.Result[i]); err != nil {
			return err
		}
	}
	return nil
}

func (s storeWithSavedQueries) GetRuleGroups(ctx context.Context, query *ngmodels.ListRuleGroupsQuery) error {
	return s.wrapped.GetRuleGroups(ctx, query)
}

func (s storeWithSavedQueries) GetRuleGroupInterval(ctx context.Context, orgID int64, namespaceUID string, ruleGroup string) (int64, error) {
	return s.wrapped.GetRuleGroupInterval(ctx, orgID, namespaceUID, ruleGroup)
}

func (s storeWithSavedQueries) GetUserVisibleNamespaces(ctx context.Context, i int64, user *user.SignedInUser) (map[string]*models.Folder, error) {
	return s.wrapped.GetUserVisibleNamespaces(ctx, i, user)
}

func (s storeWithSavedQueries) GetNamespaceByTitle(ctx context.Context, s2 string, i int64, user *user.SignedInUser, b bool) (*models.Folder, error) {
	return s.wrapped.GetNamespaceByTitle(ctx, s2, i, user, b)
}

func (s storeWithSavedQueries) GetNamespaceByUID(ctx context.Context, s2 string, i int64, user *user.SignedInUser) (*models.Folder, error) {
	return s.wrapped.GetNamespaceByUID(ctx, s2, i, user)
}

func (s storeWithSavedQueries) InsertAlertRules(ctx context.Context, rule []ngmodels.AlertRule) (map[string]int64, error) {
	updatedRules := make([]ngmodels.AlertRule, len(rule))
	for i := range rule {
		r := &rule[i]
		if err := s.updateWithSavedQueries(ctx, r); err != nil {
			return nil, err
		}
		updatedRules = append(updatedRules, *r)
	}

	return s.wrapped.InsertAlertRules(ctx, updatedRules)
}

func (s storeWithSavedQueries) UpdateAlertRules(ctx context.Context, rule []UpdateRule) error {
	updatedRules := make([]UpdateRule, len(rule))
	for i := range rule {
		r := &rule[i].New
		if err := s.updateWithSavedQueries(ctx, r); err != nil {
			return err
		}
		updatedRules = append(updatedRules, UpdateRule{
			Existing: rule[i].Existing,
			New:      *r,
		})
	}

	return s.wrapped.UpdateAlertRules(ctx, rule)
}

func (s storeWithSavedQueries) IncreaseVersionForAllRulesInNamespace(ctx context.Context, orgID int64, namespaceUID string) ([]ngmodels.AlertRuleKeyWithVersion, error) {
	return s.wrapped.IncreaseVersionForAllRulesInNamespace(ctx, orgID, namespaceUID)
}
