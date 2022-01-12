package schedule

import (
	"context"
	"encoding/json"
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/services/annotations"

	models2 "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/util"

	amv2 "github.com/prometheus/alertmanager/api/v2/models"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// waitForTimeChannel blocks the execution until either the channel ch has some data or a timeout of 10 second expires.
// Timeout will cause the test to fail.
// Returns the data from the channel.
func waitForTimeChannel(t *testing.T, ch chan time.Time) time.Time {
	select {
	case result := <-ch:
		return result
	case <-time.After(time.Duration(10) * time.Second):
		t.Fatalf("Timeout waiting for data in the time channel")
		return time.Time{}
	}
}

// waitForErrChannel blocks the execution until either the channel ch has some data or a timeout of 10 second expires.
// Timeout will cause the test to fail.
// Returns the data from the channel.
func waitForErrChannel(t *testing.T, ch chan error) error {
	timeout := time.Duration(10) * time.Second
	select {
	case result := <-ch:
		return result
	case <-time.After(timeout):
		t.Fatal("Timeout waiting for data in the error channel")
		return nil
	}
}

func newFakeRuleStore(t *testing.T) *fakeRuleStore {
	return &fakeRuleStore{
		t:     t,
		rules: map[int64]map[string]map[string][]*models.AlertRule{},
		hook: func(interface{}) error {
			return nil
		},
	}
}

// FakeRuleStore mocks the RuleStore of the scheduler.
type fakeRuleStore struct {
	t           *testing.T
	mtx         sync.Mutex
	rules       map[int64]map[string]map[string][]*models.AlertRule
	hook        func(cmd interface{}) error // use hook if you need to intercept some query and return an error
	recordedOps []interface{}
}

// putRule puts the rule in the rules map. If there are existing rule in the same namespace, they will be overwritten
func (f *fakeRuleStore) putRule(r *models.AlertRule) {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	f.rules[r.OrgID][r.RuleGroup][r.NamespaceUID] = []*models.AlertRule{
		r,
	}
}

// getRecordedCommands filters recorded commands using predicate function. Returns the subset of the recorded commands that meet the predicate
func (f *fakeRuleStore) getRecordedCommands(predicate func(cmd interface{}) (interface{}, bool)) []interface{} {
	f.mtx.Lock()
	defer f.mtx.Unlock()

	result := make([]interface{}, 0, len(f.recordedOps))
	for _, op := range f.recordedOps {
		cmd, ok := predicate(op)
		if !ok {
			continue
		}
		result = append(result, cmd)
	}
	return result
}

func (f *fakeRuleStore) DeleteAlertRuleByUID(_ int64, _ string) error { return nil }
func (f *fakeRuleStore) DeleteNamespaceAlertRules(_ int64, _ string) ([]string, error) {
	return []string{}, nil
}
func (f *fakeRuleStore) DeleteRuleGroupAlertRules(_ int64, _ string, _ string) ([]string, error) {
	return []string{}, nil
}
func (f *fakeRuleStore) DeleteAlertInstancesByRuleUID(_ int64, _ string) error { return nil }
func (f *fakeRuleStore) GetAlertRuleByUID(q *models.GetAlertRuleByUIDQuery) error {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	f.recordedOps = append(f.recordedOps, *q)
	if err := f.hook(*q); err != nil {
		return err
	}
	rgs, ok := f.rules[q.OrgID]
	if !ok {
		return nil
	}

	for _, rg := range rgs {
		for _, rules := range rg {
			for _, r := range rules {
				if r.UID == q.UID {
					q.Result = r
					break
				}
			}
		}
	}

	return nil
}

// For now, we're not implementing namespace filtering.
func (f *fakeRuleStore) GetAlertRulesForScheduling(q *models.ListAlertRulesQuery) error {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	f.recordedOps = append(f.recordedOps, *q)
	if err := f.hook(*q); err != nil {
		return err
	}
	for _, rg := range f.rules {
		for _, n := range rg {
			for _, r := range n {
				q.Result = append(q.Result, r...)
			}
		}
	}

	return nil
}
func (f *fakeRuleStore) GetOrgAlertRules(q *models.ListAlertRulesQuery) error {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	f.recordedOps = append(f.recordedOps, *q)
	return nil
}
func (f *fakeRuleStore) GetNamespaceAlertRules(q *models.ListNamespaceAlertRulesQuery) error {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	f.recordedOps = append(f.recordedOps, *q)
	return nil
}
func (f *fakeRuleStore) GetRuleGroupAlertRules(q *models.ListRuleGroupAlertRulesQuery) error {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	f.recordedOps = append(f.recordedOps, *q)
	if err := f.hook(*q); err != nil {
		return err
	}
	rgs, ok := f.rules[q.OrgID]
	if !ok {
		return nil
	}

	rg, ok := rgs[q.RuleGroup]
	if !ok {
		return nil
	}

	if q.NamespaceUID != "" {
		r, ok := rg[q.NamespaceUID]
		if !ok {
			return nil
		}
		q.Result = r
		return nil
	}

	for _, r := range rg {
		q.Result = append(q.Result, r...)
	}

	return nil
}
func (f *fakeRuleStore) GetNamespaces(_ context.Context, _ int64, _ *models2.SignedInUser) (map[string]*models2.Folder, error) {
	return nil, nil
}
func (f *fakeRuleStore) GetNamespaceByTitle(_ context.Context, _ string, _ int64, _ *models2.SignedInUser, _ bool) (*models2.Folder, error) {
	return nil, nil
}
func (f *fakeRuleStore) GetOrgRuleGroups(q *models.ListOrgRuleGroupsQuery) error {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	f.recordedOps = append(f.recordedOps, *q)
	if err := f.hook(*q); err != nil {
		return err
	}
	return nil
}

func (f *fakeRuleStore) UpsertAlertRules(q []store.UpsertRule) error {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	f.recordedOps = append(f.recordedOps, q)
	if err := f.hook(q); err != nil {
		return err
	}
	return nil
}
func (f *fakeRuleStore) UpdateRuleGroup(cmd store.UpdateRuleGroupCmd) error {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	f.recordedOps = append(f.recordedOps, cmd)
	if err := f.hook(cmd); err != nil {
		return err
	}
	rgs, ok := f.rules[cmd.OrgID]
	if !ok {
		f.rules[cmd.OrgID] = map[string]map[string][]*models.AlertRule{}
	}

	rg, ok := rgs[cmd.RuleGroupConfig.Name]
	if !ok {
		f.rules[cmd.OrgID][cmd.RuleGroupConfig.Name] = map[string][]*models.AlertRule{}
	}

	_, ok = rg[cmd.NamespaceUID]
	if !ok {
		f.rules[cmd.OrgID][cmd.RuleGroupConfig.Name][cmd.NamespaceUID] = []*models.AlertRule{}
	}

	rules := []*models.AlertRule{}
	for _, r := range cmd.RuleGroupConfig.Rules {
		// TODO: Not sure why this is not being set properly, where is the code that sets this?
		for i := range r.GrafanaManagedAlert.Data {
			r.GrafanaManagedAlert.Data[i].DatasourceUID = "-100"
		}

		new := &models.AlertRule{
			OrgID:           cmd.OrgID,
			Title:           r.GrafanaManagedAlert.Title,
			Condition:       r.GrafanaManagedAlert.Condition,
			Data:            r.GrafanaManagedAlert.Data,
			UID:             util.GenerateShortUID(),
			IntervalSeconds: int64(time.Duration(cmd.RuleGroupConfig.Interval).Seconds()),
			NamespaceUID:    cmd.NamespaceUID,
			RuleGroup:       cmd.RuleGroupConfig.Name,
			NoDataState:     models.NoDataState(r.GrafanaManagedAlert.NoDataState),
			ExecErrState:    models.ExecutionErrorState(r.GrafanaManagedAlert.ExecErrState),
			Version:         1,
		}

		if r.ApiRuleNode != nil {
			new.For = time.Duration(r.ApiRuleNode.For)
			new.Annotations = r.ApiRuleNode.Annotations
			new.Labels = r.ApiRuleNode.Labels
		}

		if new.NoDataState == "" {
			new.NoDataState = models.NoData
		}

		if new.ExecErrState == "" {
			new.ExecErrState = models.AlertingErrState
		}

		err := new.PreSave(time.Now)
		require.NoError(f.t, err)

		rules = append(rules, new)
	}

	f.rules[cmd.OrgID][cmd.RuleGroupConfig.Name][cmd.NamespaceUID] = rules
	return nil
}

type FakeInstanceStore struct {
	mtx         sync.Mutex
	recordedOps []interface{}
}

func (f *FakeInstanceStore) GetAlertInstance(q *models.GetAlertInstanceQuery) error {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	f.recordedOps = append(f.recordedOps, *q)
	return nil
}
func (f *FakeInstanceStore) ListAlertInstances(q *models.ListAlertInstancesQuery) error {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	f.recordedOps = append(f.recordedOps, *q)
	return nil
}
func (f *FakeInstanceStore) SaveAlertInstance(q *models.SaveAlertInstanceCommand) error {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	f.recordedOps = append(f.recordedOps, *q)
	return nil
}

func (f *FakeInstanceStore) FetchOrgIds() ([]int64, error)                  { return []int64{}, nil }
func (f *FakeInstanceStore) DeleteAlertInstance(_ int64, _, _ string) error { return nil }

func newFakeAdminConfigStore(t *testing.T) *fakeAdminConfigStore {
	t.Helper()
	return &fakeAdminConfigStore{configs: map[int64]*models.AdminConfiguration{}}
}

type fakeAdminConfigStore struct {
	mtx     sync.Mutex
	configs map[int64]*models.AdminConfiguration
}

func (f *fakeAdminConfigStore) GetAdminConfiguration(orgID int64) (*models.AdminConfiguration, error) {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	return f.configs[orgID], nil
}

func (f *fakeAdminConfigStore) GetAdminConfigurations() ([]*models.AdminConfiguration, error) {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	acs := make([]*models.AdminConfiguration, 0, len(f.configs))
	for _, ac := range f.configs {
		acs = append(acs, ac)
	}

	return acs, nil
}

func (f *fakeAdminConfigStore) DeleteAdminConfiguration(orgID int64) error {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	delete(f.configs, orgID)
	return nil
}
func (f *fakeAdminConfigStore) UpdateAdminConfiguration(cmd store.UpdateAdminConfigurationCmd) error {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	f.configs[cmd.AdminConfiguration.OrgID] = cmd.AdminConfiguration

	return nil
}

type FakeExternalAlertmanager struct {
	t      *testing.T
	mtx    sync.Mutex
	alerts amv2.PostableAlerts
	server *httptest.Server
}

func NewFakeExternalAlertmanager(t *testing.T) *FakeExternalAlertmanager {
	t.Helper()

	am := &FakeExternalAlertmanager{
		t:      t,
		alerts: amv2.PostableAlerts{},
	}
	am.server = httptest.NewServer(http.HandlerFunc(am.Handler()))

	return am
}

func (am *FakeExternalAlertmanager) URL() string {
	return am.server.URL
}

func (am *FakeExternalAlertmanager) AlertNamesCompare(expected []string) bool {
	n := []string{}
	alerts := am.Alerts()

	if len(expected) != len(alerts) {
		return false
	}

	for _, a := range am.Alerts() {
		for k, v := range a.Alert.Labels {
			if k == model.AlertNameLabel {
				n = append(n, v)
			}
		}
	}

	return assert.ObjectsAreEqual(expected, n)
}

func (am *FakeExternalAlertmanager) AlertsCount() int {
	am.mtx.Lock()
	defer am.mtx.Unlock()

	return len(am.alerts)
}

func (am *FakeExternalAlertmanager) Alerts() amv2.PostableAlerts {
	am.mtx.Lock()
	defer am.mtx.Unlock()
	return am.alerts
}

func (am *FakeExternalAlertmanager) Handler() func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		b, err := ioutil.ReadAll(r.Body)
		require.NoError(am.t, err)

		a := amv2.PostableAlerts{}
		require.NoError(am.t, json.Unmarshal(b, &a))

		am.mtx.Lock()
		am.alerts = append(am.alerts, a...)
		am.mtx.Unlock()
	}
}

func (am *FakeExternalAlertmanager) Close() {
	am.server.Close()
}

type FakeAnnotationsRepo struct {
	mtx   sync.Mutex
	items []*annotations.Item
}

func NewFakeAnnotationsRepo() *FakeAnnotationsRepo {
	return &FakeAnnotationsRepo{
		items: make([]*annotations.Item, 0),
	}
}

func (repo *FakeAnnotationsRepo) Len() int {
	repo.mtx.Lock()
	defer repo.mtx.Unlock()
	return len(repo.items)
}

func (repo *FakeAnnotationsRepo) Delete(params *annotations.DeleteParams) error {
	return nil
}

func (repo *FakeAnnotationsRepo) Save(item *annotations.Item) error {
	repo.mtx.Lock()
	defer repo.mtx.Unlock()
	repo.items = append(repo.items, item)

	return nil
}
func (repo *FakeAnnotationsRepo) Update(item *annotations.Item) error {
	return nil
}

func (repo *FakeAnnotationsRepo) Find(query *annotations.ItemQuery) ([]*annotations.ItemDTO, error) {
	annotations := []*annotations.ItemDTO{{Id: 1}}
	return annotations, nil
}

func (repo *FakeAnnotationsRepo) FindTags(query *annotations.TagsQuery) (annotations.FindTagsResult, error) {
	result := annotations.FindTagsResult{
		Tags: []*annotations.TagsDTO{},
	}
	return result, nil
}
