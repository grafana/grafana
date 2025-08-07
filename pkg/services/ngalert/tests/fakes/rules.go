package fakes

import (
	"context"
	"math/rand"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/util"
)

// FakeRuleStore mocks the RuleStore of the scheduler.
type RuleStore struct {
	t   *testing.T
	mtx sync.Mutex
	// OrgID -> RuleGroup -> Namespace -> Rules
	Rules       map[int64][]*models.AlertRule
	History     map[string][]*models.AlertRule
	Deleted     map[int64][]*models.AlertRule
	Hook        func(cmd any) error // use Hook if you need to intercept some query and return an error
	RecordedOps []any
	Folders     map[int64][]*folder.Folder
}

type GenericRecordedQuery struct {
	Name   string
	Params []any
}

func NewRuleStore(t *testing.T) *RuleStore {
	return &RuleStore{
		t:     t,
		Rules: map[int64][]*models.AlertRule{},
		Hook: func(any) error {
			return nil
		},
		Folders: map[int64][]*folder.Folder{},
		History: map[string][]*models.AlertRule{},
	}
}

// PutRule puts the rule in the Rules map. If there are existing rule in the same namespace, they will be overwritten
func (f *RuleStore) PutRule(_ context.Context, rules ...*models.AlertRule) {
	f.mtx.Lock()
	defer f.mtx.Unlock()
mainloop:
	for _, r := range rules {
		rgs := f.Rules[r.OrgID]
		cp := models.CopyRule(r)
		f.History[r.GUID] = append(f.History[r.GUID], cp)
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
			metrics.MFolderIDsServiceCount.WithLabelValues(metrics.NGAlerts).Inc()
			title := "TEST-FOLDER-" + util.GenerateShortUID()
			folders = append(folders, &folder.Folder{
				ID:       rand.Int63(), // nolint:staticcheck
				UID:      r.NamespaceUID,
				Title:    title,
				Fullpath: "fullpath_" + title,
			})
			f.Folders[r.OrgID] = folders
		}
	}
}

// GetRecordedCommands filters recorded commands using predicate function. Returns the subset of the recorded commands that meet the predicate
func (f *RuleStore) GetRecordedCommands(predicate func(cmd any) (any, bool)) []any {
	f.mtx.Lock()
	defer f.mtx.Unlock()

	result := make([]any, 0, len(f.RecordedOps))
	for _, op := range f.RecordedOps {
		cmd, ok := predicate(op)
		if !ok {
			continue
		}
		result = append(result, cmd)
	}
	return result
}

func (f *RuleStore) DeleteAlertRulesByUID(ctx context.Context, orgID int64, user *models.UserUID, permanently bool, UIDs ...string) error {
	f.RecordedOps = append(f.RecordedOps, GenericRecordedQuery{
		Name:   "DeleteAlertRulesByUID",
		Params: []any{orgID, user, permanently, UIDs},
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

func (f *RuleStore) DeleteRuleFromTrashByGUID(ctx context.Context, orgID int64, ruleGUID string) (int64, error) {
	f.RecordedOps = append(f.RecordedOps, GenericRecordedQuery{
		Name:   "DeleteRuleFromTrashByGUID",
		Params: []any{orgID, ruleGUID},
	})
	return 0, nil
}

func (f *RuleStore) GetAlertRuleByUID(_ context.Context, q *models.GetAlertRuleByUIDQuery) (*models.AlertRule, error) {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	f.RecordedOps = append(f.RecordedOps, *q)
	if err := f.Hook(*q); err != nil {
		return nil, err
	}
	rules := f.Rules[q.OrgID]
	for _, rule := range rules {
		if rule.UID == q.UID {
			return rule, nil
		}
	}
	return nil, models.ErrAlertRuleNotFound
}

func (f *RuleStore) GetAlertRulesGroupByRuleUID(_ context.Context, q *models.GetAlertRulesGroupByRuleUIDQuery) ([]*models.AlertRule, error) {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	f.RecordedOps = append(f.RecordedOps, *q)
	if err := f.Hook(*q); err != nil {
		return nil, err
	}
	rules, ok := f.Rules[q.OrgID]
	if !ok {
		return nil, nil
	}

	var selected *models.AlertRule
	for _, rule := range rules {
		if rule.UID == q.UID {
			selected = rule
			break
		}
	}
	if selected == nil {
		return nil, nil
	}

	ruleList := []*models.AlertRule{}
	for _, rule := range rules {
		if rule.GetGroupKey() == selected.GetGroupKey() {
			ruleList = append(ruleList, rule)
		}
	}
	return ruleList, nil
}

func (f *RuleStore) ListAlertRulesByGroup(_ context.Context, q *models.ListAlertRulesByGroupQuery) (models.RulesGroup, string, error) {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	f.RecordedOps = append(f.RecordedOps, *q)

	if err := f.Hook(*q); err != nil {
		return nil, "", err
	}

	query := &models.ListAlertRulesQuery{
		OrgID:                       q.OrgID,
		NamespaceUIDs:               q.NamespaceUIDs,
		DashboardUID:                q.DashboardUID,
		PanelID:                     q.PanelID,
		RuleGroups:                  q.RuleGroups,
		RuleUIDs:                    q.RuleUIDs,
		ReceiverName:                q.ReceiverName,
		HasPrometheusRuleDefinition: q.HasPrometheusRuleDefinition,
	}

	ruleList, err := f.listAlertRules(query)
	if err != nil {
		return nil, "", err
	}

	// < group limit logic >

	// sort rules to ensure order is consistent, pagination depends on this
	slices.SortFunc(ruleList, func(a, b *models.AlertRule) int {
		nsCmp := strings.Compare(a.NamespaceUID, b.NamespaceUID)
		if nsCmp != 0 {
			return nsCmp
		}
		rgCmp := strings.Compare(a.RuleGroup, b.RuleGroup)
		if rgCmp != 0 {
			return rgCmp
		}
		return models.RulesGroupComparer(a, b)
	})

	var nextToken string
	var cursor models.GroupCursor
	if q.GroupContinueToken != "" {
		if cur, err := models.DecodeGroupCursor(q.GroupContinueToken); err == nil {
			cursor = cur
		}
	}

	if q.GroupLimit < 0 {
		return ruleList, "", nil
	}

	outputRules := make([]*models.AlertRule, 0, len(ruleList))
	var groupsFetched int64
	initialCursor := cursor
	for _, r := range ruleList {
		// skip rules before the initial cursor
		if initialCursor.NamespaceUID != "" &&
			(strings.Compare(r.NamespaceUID, initialCursor.NamespaceUID) < 0 ||
				(strings.Compare(r.NamespaceUID, initialCursor.NamespaceUID) == 0 && strings.Compare(r.RuleGroup, initialCursor.RuleGroup) <= 0)) {
			continue
		}

		key := models.GroupCursor{
			NamespaceUID: r.NamespaceUID,
			RuleGroup:    r.RuleGroup,
		}
		if key != cursor {
			if q.GroupLimit > 0 && groupsFetched == q.GroupLimit {
				nextToken = models.EncodeGroupCursor(cursor)
				break
			}
			cursor = key
			groupsFetched++
		}

		outputRules = append(outputRules, r)
	}

	return outputRules, nextToken, nil
}

// TODO: implement pagination for this fake
func (f *RuleStore) ListAlertRulesPaginated(_ context.Context, q *models.ListAlertRulesExtendedQuery) (models.RulesGroup, string, error) {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	f.RecordedOps = append(f.RecordedOps, *q)

	if err := f.Hook(*q); err != nil {
		return nil, "", err
	}
	rules, err := f.listAlertRules(&q.ListAlertRulesQuery)
	if err != nil {
		return nil, "", err
	}
	return rules, "", nil
}

func (f *RuleStore) ListAlertRules(_ context.Context, q *models.ListAlertRulesQuery) (models.RulesGroup, error) {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	f.RecordedOps = append(f.RecordedOps, *q)

	if err := f.Hook(*q); err != nil {
		return nil, err
	}

	return f.listAlertRules(q)
}

func (f *RuleStore) listAlertRules(q *models.ListAlertRulesQuery) (models.RulesGroup, error) {
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

	ruleList := models.RulesGroup{}
	for _, r := range f.Rules[q.OrgID] {
		if !hasDashboard(r, q.DashboardUID, q.PanelID) {
			continue
		}
		if len(q.NamespaceUIDs) > 0 && !slices.Contains(q.NamespaceUIDs, r.NamespaceUID) {
			continue
		}
		if len(q.RuleGroups) > 0 && !slices.Contains(q.RuleGroups, r.RuleGroup) {
			continue
		}
		if len(q.RuleUIDs) > 0 && !slices.Contains(q.RuleUIDs, r.UID) {
			continue
		}
		if q.HasPrometheusRuleDefinition != nil {
			if *q.HasPrometheusRuleDefinition != r.HasPrometheusRuleDefinition() {
				continue
			}
		}

		if q.ReceiverName != "" && (len(r.NotificationSettings) < 1 || r.NotificationSettings[0].Receiver != q.ReceiverName) {
			continue
		}

		ruleList = append(ruleList, r)
	}

	return ruleList, nil
}

func (f *RuleStore) GetUserVisibleNamespaces(_ context.Context, orgID int64, _ identity.Requester) (map[string]*folder.Folder, error) {
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

func (f *RuleStore) GetNamespaceByUID(_ context.Context, uid string, orgID int64, user identity.Requester) (*folder.Folder, error) {
	q := GenericRecordedQuery{
		Name:   "GetNamespaceByUID",
		Params: []any{orgID, uid, user},
	}
	defer func() {
		f.RecordedOps = append(f.RecordedOps, q)
	}()
	err := f.Hook(q)
	if err != nil {
		return nil, err
	}
	folders := f.Folders[orgID]
	for _, folder := range folders {
		if folder.UID == uid {
			return folder, nil
		}
	}
	return nil, dashboards.ErrFolderNotFound
}

func (f *RuleStore) GetOrCreateNamespaceByTitle(ctx context.Context, title string, orgID int64, user identity.Requester, parentUID string) (*folder.FolderReference, error) {
	f.mtx.Lock()
	defer f.mtx.Unlock()

	for _, folder := range f.Folders[orgID] {
		if folder.Title == title && folder.ParentUID == parentUID {
			return folder.ToFolderReference(), nil
		}
	}

	newFolder := &folder.Folder{
		ID:        rand.Int63(), // nolint:staticcheck
		UID:       util.GenerateShortUID(),
		Title:     title,
		ParentUID: parentUID,
		Fullpath:  "fullpath_" + title,
	}

	f.Folders[orgID] = append(f.Folders[orgID], newFolder)
	return newFolder.ToFolderReference(), nil
}

func (f *RuleStore) GetNamespaceByTitle(ctx context.Context, title string, orgID int64, user identity.Requester, parentUID string) (*folder.FolderReference, error) {
	f.mtx.Lock()
	defer f.mtx.Unlock()

	for _, folder := range f.Folders[orgID] {
		if folder.Title == title && folder.ParentUID == parentUID {
			return folder.ToFolderReference(), nil
		}
	}

	return nil, dashboards.ErrFolderNotFound
}

func (f *RuleStore) GetNamespaceChildren(ctx context.Context, uid string, orgID int64, user identity.Requester) ([]*folder.FolderReference, error) {
	f.mtx.Lock()
	defer f.mtx.Unlock()

	result := []*folder.FolderReference{}

	for _, folder := range f.Folders[orgID] {
		if folder.ParentUID == uid {
			result = append(result, folder.ToFolderReference())
		}
	}

	if len(result) == 0 {
		return nil, dashboards.ErrFolderNotFound
	}

	return result, nil
}

func (f *RuleStore) UpdateAlertRules(_ context.Context, _ *models.UserUID, q []models.UpdateRule) error {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	f.RecordedOps = append(f.RecordedOps, q)
	if err := f.Hook(q); err != nil {
		return err
	}
	return nil
}

func (f *RuleStore) InsertAlertRules(_ context.Context, _ *models.UserUID, q []models.AlertRule) ([]models.AlertRuleKeyWithId, error) {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	f.RecordedOps = append(f.RecordedOps, q)
	ids := make([]models.AlertRuleKeyWithId, 0, len(q))
	rulesPerOrg := map[int64][]models.AlertRule{}
	for _, rule := range q {
		ids = append(ids, models.AlertRuleKeyWithId{
			AlertRuleKey: rule.GetKey(),
			ID:           rand.Int63(),
		})
		rulesPerOrg[rule.OrgID] = append(rulesPerOrg[rule.OrgID], rule)
	}

	for orgID, rules := range rulesPerOrg {
		for _, rule := range rules {
			f.Rules[orgID] = append(f.Rules[orgID], &rule)
		}
	}

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
	f.RecordedOps = append(f.RecordedOps, GenericRecordedQuery{
		Name:   "GetRuleGroupInterval",
		Params: []any{orgID, namespaceUID, ruleGroup},
	})
	for _, rule := range f.Rules[orgID] {
		if rule.RuleGroup == ruleGroup && rule.NamespaceUID == namespaceUID {
			return rule.IntervalSeconds, nil
		}
	}
	return 0, models.ErrAlertRuleGroupNotFound.Errorf("")
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

func (f *RuleStore) IncreaseVersionForAllRulesInNamespaces(_ context.Context, orgID int64, namespaceUIDs []string) ([]models.AlertRuleKeyWithVersion, error) {
	f.mtx.Lock()
	defer f.mtx.Unlock()

	f.RecordedOps = append(f.RecordedOps, GenericRecordedQuery{
		Name:   "IncreaseVersionForAllRulesInNamespaces",
		Params: []any{orgID, namespaceUIDs},
	})

	var result []models.AlertRuleKeyWithVersion

	namespaceUIDsMap := make(map[string]struct{}, len(namespaceUIDs))
	for _, namespaceUID := range namespaceUIDs {
		namespaceUIDsMap[namespaceUID] = struct{}{}
	}

	for _, rule := range f.Rules[orgID] {
		if _, ok := namespaceUIDsMap[rule.NamespaceUID]; ok && rule.OrgID == orgID {
			rule.Version++
			rule.Updated = time.Now()
			result = append(result, models.AlertRuleKeyWithVersion{
				Version:      rule.Version,
				AlertRuleKey: rule.GetKey(),
			})
		}
	}
	return result, nil
}

func (f *RuleStore) CountInFolders(ctx context.Context, orgID int64, folderUIDs []string, u identity.Requester) (int64, error) {
	return 0, nil
}

func (f *RuleStore) GetNamespacesByRuleUID(ctx context.Context, orgID int64, uids ...string) (map[string]string, error) {
	f.mtx.Lock()
	defer f.mtx.Unlock()

	namespacesMap := make(map[string]string)

	rules, ok := f.Rules[orgID]
	if !ok {
		return namespacesMap, nil
	}

	uidFilter := make(map[string]struct{}, len(uids))
	for _, uid := range uids {
		uidFilter[uid] = struct{}{}
	}

	for _, rule := range rules {
		if _, ok := uidFilter[rule.UID]; ok {
			namespacesMap[rule.UID] = rule.NamespaceUID
		}
	}

	return namespacesMap, nil
}

func (f *RuleStore) GetAlertRuleVersions(_ context.Context, orgID int64, guid string) ([]*models.AlertRule, error) {
	f.mtx.Lock()
	defer f.mtx.Unlock()

	q := GenericRecordedQuery{
		Name:   "GetAlertRuleVersions",
		Params: []any{orgID, guid},
	}
	defer func() {
		f.RecordedOps = append(f.RecordedOps, q)
	}()

	if err := f.Hook([]any{orgID, guid}); err != nil {
		return nil, err
	}

	return f.History[guid], nil
}

func (f *RuleStore) ListDeletedRules(_ context.Context, orgID int64) ([]*models.AlertRule, error) {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	defer func() {
		f.RecordedOps = append(f.RecordedOps, GenericRecordedQuery{Name: "ListDeletedRules", Params: []any{orgID}})
	}()
	if err := f.Hook(orgID); err != nil {
		return nil, err
	}
	return f.Deleted[orgID], nil
}
