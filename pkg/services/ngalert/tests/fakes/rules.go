package fakes

import (
	"context"
	"errors"
	"fmt"
	"math/rand"
	"sync"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util"
)

// FakeRuleStore mocks the RuleStore of the scheduler.
type RuleStore struct {
	t   *testing.T
	mtx sync.Mutex
	// OrgID -> RuleGroup -> Namespace -> Rules
	Rules       map[int64][]*models.AlertRule
	Hook        func(cmd interface{}) error // use Hook if you need to intercept some query and return an error
	RecordedOps []interface{}
	Folders     map[int64][]*folder.Folder
}

type GenericRecordedQuery struct {
	Name   string
	Params []interface{}
}

func NewRuleStore(t *testing.T) *RuleStore {
	return &RuleStore{
		t:     t,
		Rules: map[int64][]*models.AlertRule{},
		Hook: func(interface{}) error {
			return nil
		},
		Folders: map[int64][]*folder.Folder{},
	}
}

// PutRule puts the rule in the Rules map. If there are existing rule in the same namespace, they will be overwritten
func (f *RuleStore) PutRule(_ context.Context, rules ...*models.AlertRule) {
	f.mtx.Lock()
	defer f.mtx.Unlock()
mainloop:
	for _, r := range rules {
		rgs := f.Rules[r.OrgID]
		for idx, rulePtr := range rgs {
			if rulePtr.UID == r.UID {
				rgs[idx] = r
				continue mainloop
			}
		}
		rgs = append(rgs, r)
		f.Rules[r.OrgID] = rgs

		var existing *folder.Folder
		folders := f.Folders[r.OrgID]
		for _, folder := range folders {
			if folder.UID == r.NamespaceUID {
				existing = folder
				break
			}
		}
		if existing == nil {
			folders = append(folders, &folder.Folder{
				ID:    rand.Int63(),
				UID:   r.NamespaceUID,
				Title: "TEST-FOLDER-" + util.GenerateShortUID(),
			})
			f.Folders[r.OrgID] = folders
		}
	}
}

// GetRecordedCommands filters recorded commands using predicate function. Returns the subset of the recorded commands that meet the predicate
func (f *RuleStore) GetRecordedCommands(predicate func(cmd interface{}) (interface{}, bool)) []interface{} {
	f.mtx.Lock()
	defer f.mtx.Unlock()

	result := make([]interface{}, 0, len(f.RecordedOps))
	for _, op := range f.RecordedOps {
		cmd, ok := predicate(op)
		if !ok {
			continue
		}
		result = append(result, cmd)
	}
	return result
}

func (f *RuleStore) DeleteAlertRulesByUID(_ context.Context, orgID int64, UIDs ...string) error {
	f.RecordedOps = append(f.RecordedOps, GenericRecordedQuery{
		Name:   "DeleteAlertRulesByUID",
		Params: []interface{}{orgID, UIDs},
	})

	rules := f.Rules[orgID]

	var result = make([]*models.AlertRule, 0, len(rules))

	for _, rule := range rules {
		add := true
		for _, UID := range UIDs {
			if rule.UID == UID {
				add = false
				break
			}
		}
		if add {
			result = append(result, rule)
		}
	}

	f.Rules[orgID] = result
	return nil
}

func (f *RuleStore) GetAlertRuleByUID(_ context.Context, q *models.GetAlertRuleByUIDQuery) error {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	f.RecordedOps = append(f.RecordedOps, *q)
	if err := f.Hook(*q); err != nil {
		return err
	}
	rules, ok := f.Rules[q.OrgID]
	if !ok {
		return nil
	}

	for _, rule := range rules {
		if rule.UID == q.UID {
			q.Result = rule
			break
		}
	}
	return nil
}

func (f *RuleStore) GetAlertRulesGroupByRuleUID(_ context.Context, q *models.GetAlertRulesGroupByRuleUIDQuery) error {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	f.RecordedOps = append(f.RecordedOps, *q)
	if err := f.Hook(*q); err != nil {
		return err
	}
	rules, ok := f.Rules[q.OrgID]
	if !ok {
		return nil
	}

	var selected *models.AlertRule
	for _, rule := range rules {
		if rule.UID == q.UID {
			selected = rule
			break
		}
	}
	if selected == nil {
		return nil
	}

	for _, rule := range rules {
		if rule.GetGroupKey() == selected.GetGroupKey() {
			q.Result = append(q.Result, rule)
		}
	}
	return nil
}

func (f *RuleStore) ListAlertRules(_ context.Context, q *models.ListAlertRulesQuery) error {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	f.RecordedOps = append(f.RecordedOps, *q)

	if err := f.Hook(*q); err != nil {
		return err
	}

	hasDashboard := func(r *models.AlertRule, dashboardUID string, panelID int64) bool {
		if dashboardUID != "" {
			if r.DashboardUID == nil || *r.DashboardUID != dashboardUID {
				return false
			}
			if panelID > 0 {
				if r.PanelID == nil || *r.PanelID != panelID {
					return false
				}
			}
		}
		return true
	}

	hasNamespace := func(r *models.AlertRule, namespaceUIDs []string) bool {
		if len(namespaceUIDs) > 0 {
			var ok bool
			for _, uid := range q.NamespaceUIDs {
				if uid == r.NamespaceUID {
					ok = true
					break
				}
			}
			if !ok {
				return false
			}
		}
		return true
	}

	for _, r := range f.Rules[q.OrgID] {
		if !hasDashboard(r, q.DashboardUID, q.PanelID) {
			continue
		}
		if !hasNamespace(r, q.NamespaceUIDs) {
			continue
		}
		if q.RuleGroup != "" && r.RuleGroup != q.RuleGroup {
			continue
		}
		q.Result = append(q.Result, r)
	}

	return nil
}

func (f *RuleStore) GetUserVisibleNamespaces(_ context.Context, orgID int64, _ *user.SignedInUser) (map[string]*folder.Folder, error) {
	f.mtx.Lock()
	defer f.mtx.Unlock()

	namespacesMap := map[string]*folder.Folder{}

	_, ok := f.Rules[orgID]
	if !ok {
		return namespacesMap, nil
	}

	for _, folder := range f.Folders[orgID] {
		namespacesMap[folder.UID] = folder
	}
	return namespacesMap, nil
}

func (f *RuleStore) GetNamespaceByTitle(_ context.Context, title string, orgID int64, _ *user.SignedInUser, _ bool) (*folder.Folder, error) {
	folders := f.Folders[orgID]
	for _, folder := range folders {
		if folder.Title == title {
			return folder, nil
		}
	}
	return nil, fmt.Errorf("not found")
}

func (f *RuleStore) GetNamespaceByUID(_ context.Context, uid string, orgID int64, _ *user.SignedInUser) (*folder.Folder, error) {
	f.RecordedOps = append(f.RecordedOps, GenericRecordedQuery{
		Name:   "GetNamespaceByUID",
		Params: []interface{}{orgID, uid},
	})

	folders := f.Folders[orgID]
	for _, folder := range folders {
		if folder.UID == uid {
			return folder, nil
		}
	}
	return nil, fmt.Errorf("not found")
}

func (f *RuleStore) UpdateAlertRules(_ context.Context, q []models.UpdateRule) error {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	f.RecordedOps = append(f.RecordedOps, q)
	if err := f.Hook(q); err != nil {
		return err
	}
	return nil
}

func (f *RuleStore) InsertAlertRules(_ context.Context, q []models.AlertRule) (map[string]int64, error) {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	f.RecordedOps = append(f.RecordedOps, q)
	ids := make(map[string]int64, len(q))
	if err := f.Hook(q); err != nil {
		return ids, err
	}
	return ids, nil
}

func (f *RuleStore) InTransaction(ctx context.Context, fn func(c context.Context) error) error {
	return fn(ctx)
}

func (f *RuleStore) GetRuleGroupInterval(ctx context.Context, orgID int64, namespaceUID string, ruleGroup string) (int64, error) {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	for _, rule := range f.Rules[orgID] {
		if rule.RuleGroup == ruleGroup && rule.NamespaceUID == namespaceUID {
			return rule.IntervalSeconds, nil
		}
	}
	return 0, errors.New("rule group not found")
}

func (f *RuleStore) UpdateRuleGroup(ctx context.Context, orgID int64, namespaceUID string, ruleGroup string, interval int64) error {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	for _, rule := range f.Rules[orgID] {
		if rule.RuleGroup == ruleGroup && rule.NamespaceUID == namespaceUID {
			rule.IntervalSeconds = interval
		}
	}
	return nil
}

func (f *RuleStore) IncreaseVersionForAllRulesInNamespace(_ context.Context, orgID int64, namespaceUID string) ([]models.AlertRuleKeyWithVersionAndPauseStatus, error) {
	f.mtx.Lock()
	defer f.mtx.Unlock()

	f.RecordedOps = append(f.RecordedOps, GenericRecordedQuery{
		Name:   "IncreaseVersionForAllRulesInNamespace",
		Params: []interface{}{orgID, namespaceUID},
	})

	var result []models.AlertRuleKeyWithVersionAndPauseStatus

	for _, rule := range f.Rules[orgID] {
		if rule.NamespaceUID == namespaceUID && rule.OrgID == orgID {
			rule.Version++
			rule.Updated = time.Now()
			result = append(result, models.AlertRuleKeyWithVersionAndPauseStatus{
				IsPaused: rule.IsPaused,
				AlertRuleKeyWithVersion: models.AlertRuleKeyWithVersion{
					Version:      rule.Version,
					AlertRuleKey: rule.GetKey(),
				},
			})
		}
	}
	return result, nil
}

func (f *RuleStore) Count(ctx context.Context, orgID int64) (int64, error) {
	return 0, nil
}
