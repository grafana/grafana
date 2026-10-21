package rules

import (
	"context"
	"errors"
	"reflect"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store/provenance"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

func TestService_forwardsStoreMethods(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	requester := &user.SignedInUser{UserID: 27, OrgID: 41}
	userUID := ngmodels.UserUID("writer")
	rule := &ngmodels.AlertRule{UID: "returned-rule", OrgID: 41}
	rules := ngmodels.RulesGroup{rule}
	folderRef := &folder.FolderReference{UID: "returned-folder", Title: "Returned folder"}
	namespace := &folder.Folder{UID: "namespace", Title: "Namespace"}
	byUID := &ngmodels.GetAlertRuleByUIDQuery{OrgID: 41, UID: "requested-rule"}
	byGroup := &ngmodels.GetAlertRulesGroupByRuleUIDQuery{OrgID: 41, UID: "group-rule"}
	list := &ngmodels.ListAlertRulesQuery{OrgID: 41, NamespaceUIDs: []string{"list-folder"}}
	page := &ngmodels.ListAlertRulesExtendedQuery{Limit: 13, ContinueToken: "input-token"}
	byID := ngmodels.GetAlertRuleByIDQuery{OrgID: 41, ID: 59}
	inserts := []ngmodels.InsertRule{{AlertRule: ngmodels.AlertRule{UID: "inserted"}, Message: "create"}}
	updates := []ngmodels.UpdateRule{{Existing: rule, New: ngmodels.AlertRule{UID: "updated"}, Message: "update"}}
	routingQuery := ngmodels.ListContactPointRoutingsQuery{OrgID: 41, ReceiverName: "receiver", TimeIntervalName: "interval"}
	key := ngmodels.AlertRuleKey{OrgID: 41, UID: "routing-rule"}
	routings := map[ngmodels.AlertRuleKey]ngmodels.ContactPointRouting{key: {Receiver: "contact-point"}}
	inserted := []ngmodels.AlertRuleKeyWithId{{AlertRuleKey: key, ID: 61, GUID: "inserted-guid"}}
	versions := []*ngmodels.AlertRuleVersion{{AlertRule: ngmodels.AlertRule{UID: "versioned-rule", Version: 67}, Message: "saved version"}}
	scheduled := []ngmodels.AlertRuleKeyWithVersion{{AlertRuleKey: key, Version: 71}}
	folders := []string{"first-folder", "second-folder"}
	uids := []string{"first-rule", "second-rule"}
	status := []byte(`{"state":"ok"}`)

	tests := []struct {
		name string
		args []any
		out  []any
		call func(*Service) []any
	}{
		{"ListAlertRuleUIDsInFolder", []any{ctx, int64(41), "requested-folder"}, []any{uids}, func(s *Service) []any { return serviceResult(s.ListAlertRuleUIDsInFolder(ctx, 41, "requested-folder")) }},
		{"GetFolderUIDsWithMissingFullpath", []any{ctx, int64(41)}, []any{folders}, func(s *Service) []any { return serviceResult(s.GetFolderUIDsWithMissingFullpath(ctx, 41)) }},
		{"GetUserVisibleNamespaces", []any{ctx, int64(41), requester}, []any{map[string]*folder.Folder{"namespace": namespace}}, func(s *Service) []any { return serviceResult(s.GetUserVisibleNamespaces(ctx, 41, requester)) }},
		{"GetNamespaceByUID", []any{ctx, "requested-namespace", int64(41), requester}, []any{namespace}, func(s *Service) []any {
			return serviceResult(s.GetNamespaceByUID(ctx, "requested-namespace", 41, requester))
		}},
		{"GetNamespaceByTitle", []any{ctx, "Requested title", int64(41), requester, "parent"}, []any{folderRef}, func(s *Service) []any {
			return serviceResult(s.GetNamespaceByTitle(ctx, "Requested title", 41, requester, "parent"))
		}},
		{"GetOrCreateNamespaceByTitle", []any{ctx, "New title", int64(41), requester, "new-parent"}, []any{folderRef, true}, func(s *Service) []any {
			return serviceThreeResults(s.GetOrCreateNamespaceByTitle(ctx, "New title", 41, requester, "new-parent"))
		}},
		{"GetNamespaceChildren", []any{ctx, "parent-namespace", int64(41), requester}, []any{[]*folder.FolderReference{folderRef}}, func(s *Service) []any {
			return serviceResult(s.GetNamespaceChildren(ctx, "parent-namespace", 41, requester))
		}},
		{"GetNamespacesByRuleUID", []any{ctx, int64(41), uids}, []any{map[string]string{"returned-rule": "returned-folder"}}, func(s *Service) []any { return serviceResult(s.GetNamespacesByRuleUID(ctx, 41, uids...)) }},
		{"GetAlertRuleByUID", []any{ctx, byUID}, []any{rule}, func(s *Service) []any { return serviceResult(s.GetAlertRuleByUID(ctx, byUID)) }},
		{"GetAlertRulesGroupByRuleUID", []any{ctx, byGroup}, []any{[]*ngmodels.AlertRule{rule}}, func(s *Service) []any { return serviceResult(s.GetAlertRulesGroupByRuleUID(ctx, byGroup)) }},
		{"ListDeletedRules", []any{ctx, int64(41)}, []any{[]*ngmodels.AlertRule{rule}}, func(s *Service) []any { return serviceResult(s.ListDeletedRules(ctx, 41)) }},
		{"ListAlertRules", []any{ctx, list}, []any{rules}, func(s *Service) []any { return serviceResult(s.ListAlertRules(ctx, list)) }},
		{"ListAlertRulesPaginated", []any{ctx, page}, []any{rules, "next-page"}, func(s *Service) []any { return serviceThreeResults(s.ListAlertRulesPaginated(ctx, page)) }},
		{"GetRuleGroupInterval", []any{ctx, int64(41), "interval-folder", "interval-group"}, []any{int64(83)}, func(s *Service) []any {
			return serviceResult(s.GetRuleGroupInterval(ctx, 41, "interval-folder", "interval-group"))
		}},
		{"GetRuleByID", []any{ctx, byID}, []any{rule}, func(s *Service) []any { return serviceResult(s.GetRuleByID(ctx, byID)) }},
		{"ListAlertRulesByGroup", []any{ctx, page}, []any{rules, "next-group"}, func(s *Service) []any { return serviceThreeResults(s.ListAlertRulesByGroup(ctx, page)) }},
		{"Count", []any{ctx, int64(41)}, []any{int64(89)}, func(s *Service) []any { return serviceResult(s.Count(ctx, 41)) }},
		{"CountRuleGroups", []any{ctx, int64(41)}, []any{int64(97)}, func(s *Service) []any { return serviceResult(s.CountRuleGroups(ctx, 41)) }},
		{"InsertAlertRules", []any{ctx, &userUID, inserts}, []any{inserted}, func(s *Service) []any { return serviceResult(s.InsertAlertRules(ctx, &userUID, inserts)) }},
		{"UpdateAlertRules", []any{ctx, &userUID, updates}, nil, func(s *Service) []any { return []any{s.UpdateAlertRules(ctx, &userUID, updates)} }},
		{"DeleteAlertRulesByUID", []any{ctx, int64(41), &userUID, true, uids}, nil, func(s *Service) []any { return []any{s.DeleteAlertRulesByUID(ctx, 41, &userUID, true, uids...)} }},
		{"DeleteRuleFromTrashByGUID", []any{ctx, int64(41), "deleted-guid"}, []any{int64(101)}, func(s *Service) []any { return serviceResult(s.DeleteRuleFromTrashByGUID(ctx, 41, "deleted-guid")) }},
		{"UpdateFolderFullpathsForFolders", []any{ctx, int64(41), folders}, nil, func(s *Service) []any { return []any{s.UpdateFolderFullpathsForFolders(ctx, 41, folders)} }},
		{"GetAlertRuleVersions", []any{ctx, int64(41), "version-guid"}, []any{versions}, func(s *Service) []any { return serviceResult(s.GetAlertRuleVersions(ctx, 41, "version-guid")) }},
		{"GetAlertRuleVersionFolders", []any{ctx, int64(41), "folder-version-guid"}, []any{folders}, func(s *Service) []any {
			return serviceResult(s.GetAlertRuleVersionFolders(ctx, 41, "folder-version-guid"))
		}},
		{"GetAlertRulesKeysForScheduling", []any{ctx}, []any{scheduled}, func(s *Service) []any { return serviceResult(s.GetAlertRulesKeysForScheduling(ctx)) }},
		{"ListContactPointRoutings", []any{ctx, routingQuery}, []any{routings}, func(s *Service) []any { return serviceResult(s.ListContactPointRoutings(ctx, routingQuery)) }},
		{"SaveAlertRuleStatus", []any{ctx, int64(41), "status-rule", status}, nil, func(s *Service) []any { return []any{s.SaveAlertRuleStatus(ctx, 41, "status-rule", status)} }},
		{"DeleteInFolders", []any{ctx, int64(41), folders, requester}, nil, func(s *Service) []any { return []any{s.DeleteInFolders(ctx, 41, folders, requester)} }},
		{"CountInFolders", []any{ctx, int64(41), folders, requester}, []any{int64(103)}, func(s *Service) []any { return serviceResult(s.CountInFolders(ctx, 41, folders, requester)) }},
		{"GetAllFoldersWithRules", []any{ctx, int64(41)}, []any{map[string]struct{}{"occupied-folder": {}}}, func(s *Service) []any { return serviceResult(s.GetAllFoldersWithRules(ctx, 41)) }},
		{"CleanUpDeletedAlertRules", []any{ctx}, []any{int64(107)}, func(s *Service) []any { return serviceResult(s.CleanUpDeletedAlertRules(ctx)) }},
	}

	covered := map[string]bool{"Kind": true, "GetAlertRulesForScheduling": true, "RenameReceiverInNotificationSettings": true, "RenameTimeIntervalInNotificationSettings": true}
	for _, tc := range tests {
		covered[tc.name] = true
		t.Run(tc.name, func(t *testing.T) {
			for _, err := range []error{nil, errors.New("sql failure")} {
				name := "success"
				if err != nil {
					name = "error"
				}
				t.Run(name, func(t *testing.T) {
					spy := &serviceStoreSpy{t: t, method: tc.name, args: tc.args, out: tc.out, err: err}
					got := tc.call(&Service{sql: spy})
					want := append(append([]any{}, tc.out...), err)
					require.Equal(t, want, got)
					if err != nil {
						require.ErrorIs(t, got[len(got)-1].(error), err)
					}
					require.Equal(t, 1, spy.calls)
				})
			}
		})
	}
	storeType := reflect.TypeFor[Store]()
	require.Len(t, covered, storeType.NumMethod())
	for i := 0; i < storeType.NumMethod(); i++ {
		require.True(t, covered[storeType.Method(i).Name], "missing forwarding test for %s", storeType.Method(i).Name)
	}
}

func TestService_preservesNilAndEmptyResults(t *testing.T) {
	for _, tc := range []struct {
		name  string
		rules ngmodels.RulesGroup
	}{
		{name: "nil"},
		{name: "empty", rules: ngmodels.RulesGroup{}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			query := &ngmodels.ListAlertRulesQuery{OrgID: 41}
			spy := &serviceStoreSpy{
				t: t, method: "ListAlertRules", args: []any{ctx, query}, out: []any{tc.rules},
			}
			got, err := (&Service{sql: spy}).ListAlertRules(ctx, query)
			require.NoError(t, err)
			require.Equal(t, tc.rules, got)
			require.Equal(t, 1, spy.calls)
		})
	}
}

func TestService_preservesRulePointer(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	query := &ngmodels.GetAlertRuleByUIDQuery{OrgID: 41, UID: "requested-rule"}
	rule := &ngmodels.AlertRule{OrgID: 41, UID: query.UID}
	spy := &serviceStoreSpy{
		t: t, method: "GetAlertRuleByUID", args: []any{ctx, query}, out: []any{rule},
	}
	got, err := (&Service{sql: spy}).GetAlertRuleByUID(ctx, query)
	require.NoError(t, err)
	require.Same(t, rule, got)
	require.Equal(t, 1, spy.calls)
}

func TestService_forwardsEmptyVariadics(t *testing.T) {
	for _, tc := range []struct {
		name string
		uids []string
	}{
		{name: "nil"},
		{name: "empty", uids: []string{}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			wantErr := errors.New("empty UID request")
			namespaces := map[string]string{"rule": "folder"}
			lookup := &serviceStoreSpy{
				t: t, method: "GetNamespacesByRuleUID", args: []any{ctx, int64(41), tc.uids},
				out: []any{namespaces}, err: wantErr,
			}
			got, err := (&Service{sql: lookup}).GetNamespacesByRuleUID(ctx, 41, tc.uids...)
			require.Equal(t, namespaces, got)
			require.ErrorIs(t, err, wantErr)
			require.Equal(t, 1, lookup.calls)

			deletion := &serviceStoreSpy{
				t: t, method: "DeleteAlertRulesByUID", args: []any{ctx, int64(41), (*ngmodels.UserUID)(nil), false, tc.uids},
				err: wantErr,
			}
			err = (&Service{sql: deletion}).DeleteAlertRulesByUID(ctx, 41, nil, false, tc.uids...)
			require.ErrorIs(t, err, wantErr)
			require.Equal(t, 1, deletion.calls)
		})
	}
}

func serviceResult[T any](value T, err error) []any {
	return []any{value, err}
}

func serviceThreeResults[T, U any](first T, second U, err error) []any {
	return []any{first, second, err}
}

type serviceStoreSpy struct {
	Store
	t      *testing.T
	method string
	args   []any
	out    []any
	err    error
	calls  int
}

func (s *serviceStoreSpy) check(method string, args ...any) {
	s.t.Helper()
	s.calls++
	require.Equal(s.t, s.method, method)
	require.Equal(s.t, s.args, args)
	if len(args) > 0 {
		require.Same(s.t, s.args[0], args[0], "context must be forwarded unchanged")
	}
}

func (s *serviceStoreSpy) ListAlertRuleUIDsInFolder(ctx context.Context, orgID int64, folderUID string) ([]string, error) {
	s.check("ListAlertRuleUIDsInFolder", ctx, orgID, folderUID)
	return s.out[0].([]string), s.err
}

func (s *serviceStoreSpy) GetFolderUIDsWithMissingFullpath(ctx context.Context, orgID int64) ([]string, error) {
	s.check("GetFolderUIDsWithMissingFullpath", ctx, orgID)
	return s.out[0].([]string), s.err
}

func (s *serviceStoreSpy) GetUserVisibleNamespaces(ctx context.Context, orgID int64, user identity.Requester) (map[string]*folder.Folder, error) {
	s.check("GetUserVisibleNamespaces", ctx, orgID, user)
	return s.out[0].(map[string]*folder.Folder), s.err
}

func (s *serviceStoreSpy) GetNamespaceByUID(ctx context.Context, uid string, orgID int64, user identity.Requester) (*folder.Folder, error) {
	s.check("GetNamespaceByUID", ctx, uid, orgID, user)
	return s.out[0].(*folder.Folder), s.err
}

func (s *serviceStoreSpy) GetNamespaceByTitle(ctx context.Context, title string, orgID int64, user identity.Requester, parentUID string) (*folder.FolderReference, error) {
	s.check("GetNamespaceByTitle", ctx, title, orgID, user, parentUID)
	return s.out[0].(*folder.FolderReference), s.err
}

func (s *serviceStoreSpy) GetOrCreateNamespaceByTitle(ctx context.Context, title string, orgID int64, user identity.Requester, parentUID string) (*folder.FolderReference, bool, error) {
	s.check("GetOrCreateNamespaceByTitle", ctx, title, orgID, user, parentUID)
	return s.out[0].(*folder.FolderReference), s.out[1].(bool), s.err
}

func (s *serviceStoreSpy) GetNamespaceChildren(ctx context.Context, uid string, orgID int64, user identity.Requester) ([]*folder.FolderReference, error) {
	s.check("GetNamespaceChildren", ctx, uid, orgID, user)
	return s.out[0].([]*folder.FolderReference), s.err
}

func (s *serviceStoreSpy) GetNamespacesByRuleUID(ctx context.Context, orgID int64, uids ...string) (map[string]string, error) {
	s.check("GetNamespacesByRuleUID", ctx, orgID, uids)
	return s.out[0].(map[string]string), s.err
}

func (s *serviceStoreSpy) GetAlertRuleByUID(ctx context.Context, query *ngmodels.GetAlertRuleByUIDQuery) (*ngmodels.AlertRule, error) {
	s.check("GetAlertRuleByUID", ctx, query)
	require.Same(s.t, s.args[1], query)
	return s.out[0].(*ngmodels.AlertRule), s.err
}

func (s *serviceStoreSpy) GetAlertRulesGroupByRuleUID(ctx context.Context, query *ngmodels.GetAlertRulesGroupByRuleUIDQuery) ([]*ngmodels.AlertRule, error) {
	s.check("GetAlertRulesGroupByRuleUID", ctx, query)
	return s.out[0].([]*ngmodels.AlertRule), s.err
}

func (s *serviceStoreSpy) ListDeletedRules(ctx context.Context, orgID int64) ([]*ngmodels.AlertRule, error) {
	s.check("ListDeletedRules", ctx, orgID)
	return s.out[0].([]*ngmodels.AlertRule), s.err
}

func (s *serviceStoreSpy) ListAlertRules(ctx context.Context, query *ngmodels.ListAlertRulesQuery) (ngmodels.RulesGroup, error) {
	s.check("ListAlertRules", ctx, query)
	return s.out[0].(ngmodels.RulesGroup), s.err
}

func (s *serviceStoreSpy) ListAlertRulesPaginated(ctx context.Context, query *ngmodels.ListAlertRulesExtendedQuery) (ngmodels.RulesGroup, string, error) {
	s.check("ListAlertRulesPaginated", ctx, query)
	return s.out[0].(ngmodels.RulesGroup), s.out[1].(string), s.err
}

func (s *serviceStoreSpy) GetRuleGroupInterval(ctx context.Context, orgID int64, namespaceUID string, ruleGroup string) (int64, error) {
	s.check("GetRuleGroupInterval", ctx, orgID, namespaceUID, ruleGroup)
	return s.out[0].(int64), s.err
}

func (s *serviceStoreSpy) GetRuleByID(ctx context.Context, query ngmodels.GetAlertRuleByIDQuery) (*ngmodels.AlertRule, error) {
	s.check("GetRuleByID", ctx, query)
	return s.out[0].(*ngmodels.AlertRule), s.err
}

func (s *serviceStoreSpy) ListAlertRulesByGroup(ctx context.Context, query *ngmodels.ListAlertRulesExtendedQuery) (ngmodels.RulesGroup, string, error) {
	s.check("ListAlertRulesByGroup", ctx, query)
	return s.out[0].(ngmodels.RulesGroup), s.out[1].(string), s.err
}

func (s *serviceStoreSpy) Count(ctx context.Context, orgID int64) (int64, error) {
	s.check("Count", ctx, orgID)
	return s.out[0].(int64), s.err
}

func (s *serviceStoreSpy) CountRuleGroups(ctx context.Context, orgID int64) (int64, error) {
	s.check("CountRuleGroups", ctx, orgID)
	return s.out[0].(int64), s.err
}

func (s *serviceStoreSpy) InsertAlertRules(ctx context.Context, user *ngmodels.UserUID, rules []ngmodels.InsertRule) ([]ngmodels.AlertRuleKeyWithId, error) {
	s.check("InsertAlertRules", ctx, user, rules)
	return s.out[0].([]ngmodels.AlertRuleKeyWithId), s.err
}

func (s *serviceStoreSpy) UpdateAlertRules(ctx context.Context, user *ngmodels.UserUID, rules []ngmodels.UpdateRule) error {
	s.check("UpdateAlertRules", ctx, user, rules)
	return s.err
}

func (s *serviceStoreSpy) DeleteAlertRulesByUID(ctx context.Context, orgID int64, user *ngmodels.UserUID, permanently bool, ruleUID ...string) error {
	s.check("DeleteAlertRulesByUID", ctx, orgID, user, permanently, ruleUID)
	return s.err
}

func (s *serviceStoreSpy) DeleteRuleFromTrashByGUID(ctx context.Context, orgID int64, ruleGUID string) (int64, error) {
	s.check("DeleteRuleFromTrashByGUID", ctx, orgID, ruleGUID)
	return s.out[0].(int64), s.err
}

func (s *serviceStoreSpy) UpdateFolderFullpathsForFolders(ctx context.Context, orgID int64, folderUIDs []string) error {
	s.check("UpdateFolderFullpathsForFolders", ctx, orgID, folderUIDs)
	return s.err
}

func (s *serviceStoreSpy) GetAlertRuleVersions(ctx context.Context, orgID int64, guid string) ([]*ngmodels.AlertRuleVersion, error) {
	s.check("GetAlertRuleVersions", ctx, orgID, guid)
	return s.out[0].([]*ngmodels.AlertRuleVersion), s.err
}

func (s *serviceStoreSpy) GetAlertRuleVersionFolders(ctx context.Context, orgID int64, guid string) ([]string, error) {
	s.check("GetAlertRuleVersionFolders", ctx, orgID, guid)
	return s.out[0].([]string), s.err
}

func (s *serviceStoreSpy) GetAlertRulesKeysForScheduling(ctx context.Context) ([]ngmodels.AlertRuleKeyWithVersion, error) {
	s.check("GetAlertRulesKeysForScheduling", ctx)
	return s.out[0].([]ngmodels.AlertRuleKeyWithVersion), s.err
}

func (s *serviceStoreSpy) ListContactPointRoutings(ctx context.Context, query ngmodels.ListContactPointRoutingsQuery) (map[ngmodels.AlertRuleKey]ngmodels.ContactPointRouting, error) {
	s.check("ListContactPointRoutings", ctx, query)
	return s.out[0].(map[ngmodels.AlertRuleKey]ngmodels.ContactPointRouting), s.err
}

func (s *serviceStoreSpy) SaveAlertRuleStatus(ctx context.Context, orgID int64, ruleUID string, data []byte) error {
	s.check("SaveAlertRuleStatus", ctx, orgID, ruleUID, data)
	return s.err
}

func (s *serviceStoreSpy) DeleteInFolders(ctx context.Context, orgID int64, folderUIDs []string, user identity.Requester) error {
	s.check("DeleteInFolders", ctx, orgID, folderUIDs, user)
	return s.err
}

func (s *serviceStoreSpy) CountInFolders(ctx context.Context, orgID int64, folderUIDs []string, user identity.Requester) (int64, error) {
	s.check("CountInFolders", ctx, orgID, folderUIDs, user)
	return s.out[0].(int64), s.err
}

func (s *serviceStoreSpy) GetAllFoldersWithRules(ctx context.Context, orgID int64) (map[string]struct{}, error) {
	s.check("GetAllFoldersWithRules", ctx, orgID)
	return s.out[0].(map[string]struct{}), s.err
}

func (s *serviceStoreSpy) CleanUpDeletedAlertRules(ctx context.Context) (int64, error) {
	s.check("CleanUpDeletedAlertRules", ctx)
	return s.out[0].(int64), s.err
}

type serviceSchedulingSpy struct {
	Store
	ctx   context.Context
	query *ngmodels.GetAlertRulesForSchedulingQuery
	err   error
}

func (s *serviceSchedulingSpy) GetAlertRulesForScheduling(ctx context.Context, query *ngmodels.GetAlertRulesForSchedulingQuery) error {
	s.ctx = ctx
	s.query = query
	query.ResultRules = []*ngmodels.AlertRule{{UID: "scheduled-rule", OrgID: 41}}
	query.ResultFoldersTitles = map[ngmodels.FolderKey]string{{OrgID: 41, UID: "scheduled-folder"}: "Scheduled folder"}
	return s.err
}

func TestService_forwardsSchedulingQueryMutation(t *testing.T) {
	for _, err := range []error{nil, errors.New("scheduling failure")} {
		ctx, cancel := context.WithCancel(context.Background())
		cancel()
		query := &ngmodels.GetAlertRulesForSchedulingQuery{PopulateFolders: true, RuleGroups: []string{"scheduled-group"}}
		spy := &serviceSchedulingSpy{err: err}
		service := &Service{sql: spy}
		require.Equal(t, err, service.GetAlertRulesForScheduling(ctx, query))
		require.Same(t, ctx, spy.ctx)
		require.Same(t, query, spy.query)
		require.True(t, spy.query.PopulateFolders)
		require.Equal(t, []string{"scheduled-group"}, spy.query.RuleGroups)
		require.Equal(t, []*ngmodels.AlertRule{{UID: "scheduled-rule", OrgID: 41}}, query.ResultRules)
		require.Equal(t, map[ngmodels.FolderKey]string{{OrgID: 41, UID: "scheduled-folder"}: "Scheduled folder"}, query.ResultFoldersTitles)
	}
}

type serviceRenameSpy struct {
	Store
	t        *testing.T
	ctx      context.Context
	method   string
	dryRun   bool
	err      error
	modified []ngmodels.AlertRuleKey
	skipped  []ngmodels.AlertRuleKey
	calls    int
}

func (s *serviceRenameSpy) rename(method string, ctx context.Context, orgID int64, oldName, newName string, validate func(ngmodels.Provenance) bool, dryRun bool) ([]ngmodels.AlertRuleKey, []ngmodels.AlertRuleKey, error) {
	s.t.Helper()
	s.calls++
	require.Equal(s.t, s.method, method)
	require.Same(s.t, s.ctx, ctx)
	require.Equal(s.t, int64(41), orgID)
	require.Equal(s.t, "old-name", oldName)
	require.Equal(s.t, "new-name", newName)
	require.Equal(s.t, s.dryRun, dryRun)
	require.True(s.t, validate(ngmodels.ProvenanceNone))
	require.False(s.t, validate(ngmodels.ProvenanceAPI))
	return s.modified, s.skipped, s.err
}

func (s *serviceRenameSpy) RenameReceiverInNotificationSettings(ctx context.Context, orgID int64, oldName, newName string, validate func(ngmodels.Provenance) bool, dryRun bool) ([]ngmodels.AlertRuleKey, []ngmodels.AlertRuleKey, error) {
	return s.rename("receiver", ctx, orgID, oldName, newName, validate, dryRun)
}

func (s *serviceRenameSpy) RenameTimeIntervalInNotificationSettings(ctx context.Context, orgID int64, oldName, newName string, validate func(ngmodels.Provenance) bool, dryRun bool) ([]ngmodels.AlertRuleKey, []ngmodels.AlertRuleKey, error) {
	return s.rename("time interval", ctx, orgID, oldName, newName, validate, dryRun)
}

func TestService_forwardsRenameCallbacks(t *testing.T) {
	for _, method := range []string{"receiver", "time interval"} {
		t.Run(method, func(t *testing.T) {
			for _, dryRun := range []bool{false, true} {
				for _, err := range []error{nil, errors.New("rename failure")} {
					ctx, cancel := context.WithCancel(context.Background())
					cancel()
					spy := &serviceRenameSpy{
						t: t, ctx: ctx, method: method, dryRun: dryRun, err: err,
						modified: []ngmodels.AlertRuleKey{{OrgID: 41, UID: "modified"}},
						skipped:  []ngmodels.AlertRuleKey{{OrgID: 41, UID: "skipped"}},
					}
					service := &Service{sql: spy}
					var provenances []ngmodels.Provenance
					validate := func(p ngmodels.Provenance) bool {
						provenances = append(provenances, p)
						return p == ngmodels.ProvenanceNone
					}
					rename := service.RenameReceiverInNotificationSettings
					if method == "time interval" {
						rename = service.RenameTimeIntervalInNotificationSettings
					}
					modified, skipped, gotErr := rename(ctx, 41, "old-name", "new-name", validate, dryRun)
					require.Equal(t, err, gotErr)
					require.Equal(t, spy.modified, modified)
					require.Equal(t, spy.skipped, skipped)
					require.Equal(t, []ngmodels.Provenance{ngmodels.ProvenanceNone, ngmodels.ProvenanceAPI}, provenances)
					require.Equal(t, 1, spy.calls)
				}
			}
		})
	}
}

type serviceKindSpy struct {
	Store
	calls int
}

func (s *serviceKindSpy) Kind() string {
	s.calls++
	return "sql-kind"
}

func TestService_forwardsKind(t *testing.T) {
	spy := &serviceKindSpy{}
	require.Equal(t, "sql-kind", (&Service{sql: spy}).Kind())
	require.Equal(t, 1, spy.calls)
}

type serviceFolderSpy struct {
	folder.Service
	registered folder.RegistryService
	calls      int
	err        error
}

func (s *serviceFolderSpy) RegisterService(service folder.RegistryService) error {
	s.calls++
	s.registered = service
	return s.err
}

func TestProvideService_registersWrapperUsingOriginalSQLStore(t *testing.T) {
	sql := &RuleStore{Logger: &logtest.Fake{}}
	folders := &serviceFolderSpy{}
	service, err := ProvideService(sql, folders)
	require.NoError(t, err)
	require.Same(t, sql, service.sql)
	require.Same(t, service, folders.registered)
	require.Equal(t, 1, folders.calls)
	require.Nil(t, sql.LegacyDatabaseProvider)
}

func TestProvideService_returnsRegistrationError(t *testing.T) {
	wantErr := errors.New("registration failure")
	folders := &serviceFolderSpy{err: wantErr}
	service, err := ProvideService(&RuleStore{}, folders)
	require.Nil(t, service)
	require.ErrorIs(t, err, wantErr)
	require.Equal(t, 1, folders.calls)
}

func TestProvideRuleStore_doesNotRegisterAndPreservesNilDatabaseProvider(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.UnifiedAlerting.BaseInterval = 17
	folders := &serviceFolderSpy{err: errors.New("must not register SQL directly")}
	provenances := &provenance.ProvenanceStore{}
	store, err := ProvideRuleStore(cfg, featuremgmt.WithFeatures(), nil, folders, nil, provenances)
	require.NoError(t, err)
	require.Equal(t, cfg.UnifiedAlerting, store.Cfg)
	require.Same(t, folders, store.FolderService)
	require.Same(t, provenances, store.Provenance)
	require.Nil(t, store.LegacyDatabaseProvider)
	require.Zero(t, folders.calls)
}
