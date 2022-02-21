package store

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
	"github.com/grafana/grafana/pkg/util"

	amv2 "github.com/prometheus/alertmanager/api/v2/models"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func NewFakeRuleStore(t *testing.T) *FakeRuleStore {
	return &FakeRuleStore{
		t:     t,
		Rules: map[int64]map[string]map[string][]*models.AlertRule{},
		Hook: func(interface{}) error {
			return nil
		},
	}
}

// FakeRuleStore mocks the RuleStore of the scheduler.
type FakeRuleStore struct {
	t           *testing.T
	mtx         sync.Mutex
	Rules       map[int64]map[string]map[string][]*models.AlertRule
	Hook        func(cmd interface{}) error // use Hook if you need to intercept some query and return an error
	RecordedOps []interface{}
}

// PutRule puts the rule in the Rules map. If there are existing rule in the same namespace, they will be overwritten
func (f *FakeRuleStore) PutRule(_ context.Context, r *models.AlertRule) {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	f.Rules[r.OrgID][r.RuleGroup][r.NamespaceUID] = []*models.AlertRule{
		r,
	}
}

// GetRecordedCommands filters recorded commands using predicate function. Returns the subset of the recorded commands that meet the predicate
func (f *FakeRuleStore) GetRecordedCommands(predicate func(cmd interface{}) (interface{}, bool)) []interface{} {
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

func (f *FakeRuleStore) DeleteAlertRuleByUID(_ context.Context, _ int64, _ string) error { return nil }
func (f *FakeRuleStore) DeleteNamespaceAlertRules(_ context.Context, _ int64, _ string) ([]string, error) {
	return []string{}, nil
}
func (f *FakeRuleStore) DeleteRuleGroupAlertRules(_ context.Context, _ int64, _ string, _ string) ([]string, error) {
	return []string{}, nil
}
func (f *FakeRuleStore) DeleteAlertInstancesByRuleUID(_ context.Context, _ int64, _ string) error {
	return nil
}
func (f *FakeRuleStore) GetAlertRuleByUID(_ context.Context, q *models.GetAlertRuleByUIDQuery) error {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	f.RecordedOps = append(f.RecordedOps, *q)
	if err := f.Hook(*q); err != nil {
		return err
	}
	rgs, ok := f.Rules[q.OrgID]
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
func (f *FakeRuleStore) GetAlertRulesForScheduling(_ context.Context, q *models.ListAlertRulesQuery) error {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	f.RecordedOps = append(f.RecordedOps, *q)
	if err := f.Hook(*q); err != nil {
		return err
	}
	for _, rg := range f.Rules {
		for _, n := range rg {
			for _, r := range n {
				q.Result = append(q.Result, r...)
			}
		}
	}

	return nil
}
func (f *FakeRuleStore) GetOrgAlertRules(_ context.Context, q *models.ListAlertRulesQuery) error {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	f.RecordedOps = append(f.RecordedOps, *q)
	return nil
}
func (f *FakeRuleStore) GetNamespaceAlertRules(_ context.Context, q *models.ListNamespaceAlertRulesQuery) error {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	f.RecordedOps = append(f.RecordedOps, *q)
	return nil
}
func (f *FakeRuleStore) GetRuleGroupAlertRules(_ context.Context, q *models.ListRuleGroupAlertRulesQuery) error {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	f.RecordedOps = append(f.RecordedOps, *q)
	if err := f.Hook(*q); err != nil {
		return err
	}
	rgs, ok := f.Rules[q.OrgID]
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
func (f *FakeRuleStore) GetNamespaces(_ context.Context, _ int64, _ *models2.SignedInUser) (map[string]*models2.Folder, error) {
	return nil, nil
}
func (f *FakeRuleStore) GetNamespaceByTitle(_ context.Context, _ string, _ int64, _ *models2.SignedInUser, _ bool) (*models2.Folder, error) {
	return nil, nil
}
func (f *FakeRuleStore) GetOrgRuleGroups(_ context.Context, q *models.ListOrgRuleGroupsQuery) error {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	f.RecordedOps = append(f.RecordedOps, *q)
	if err := f.Hook(*q); err != nil {
		return err
	}
	return nil
}

func (f *FakeRuleStore) UpsertAlertRules(_ context.Context, q []UpsertRule) error {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	f.RecordedOps = append(f.RecordedOps, q)
	if err := f.Hook(q); err != nil {
		return err
	}
	return nil
}
func (f *FakeRuleStore) UpdateRuleGroup(_ context.Context, cmd UpdateRuleGroupCmd) error {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	f.RecordedOps = append(f.RecordedOps, cmd)
	if err := f.Hook(cmd); err != nil {
		return err
	}
	rgs, ok := f.Rules[cmd.OrgID]
	if !ok {
		f.Rules[cmd.OrgID] = map[string]map[string][]*models.AlertRule{}
	}

	rg, ok := rgs[cmd.RuleGroupConfig.Name]
	if !ok {
		f.Rules[cmd.OrgID][cmd.RuleGroupConfig.Name] = map[string][]*models.AlertRule{}
	}

	_, ok = rg[cmd.NamespaceUID]
	if !ok {
		f.Rules[cmd.OrgID][cmd.RuleGroupConfig.Name][cmd.NamespaceUID] = []*models.AlertRule{}
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

	f.Rules[cmd.OrgID][cmd.RuleGroupConfig.Name][cmd.NamespaceUID] = rules
	return nil
}

type FakeInstanceStore struct {
	mtx         sync.Mutex
	RecordedOps []interface{}
}

func (f *FakeInstanceStore) GetAlertInstance(_ context.Context, q *models.GetAlertInstanceQuery) error {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	f.RecordedOps = append(f.RecordedOps, *q)
	return nil
}
func (f *FakeInstanceStore) ListAlertInstances(_ context.Context, q *models.ListAlertInstancesQuery) error {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	f.RecordedOps = append(f.RecordedOps, *q)
	return nil
}
func (f *FakeInstanceStore) SaveAlertInstance(_ context.Context, q *models.SaveAlertInstanceCommand) error {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	f.RecordedOps = append(f.RecordedOps, *q)
	return nil
}

func (f *FakeInstanceStore) FetchOrgIds(_ context.Context) ([]int64, error) { return []int64{}, nil }
func (f *FakeInstanceStore) DeleteAlertInstance(_ context.Context, _ int64, _, _ string) error {
	return nil
}

func NewFakeAdminConfigStore(t *testing.T) *FakeAdminConfigStore {
	t.Helper()
	return &FakeAdminConfigStore{Configs: map[int64]*models.AdminConfiguration{}}
}

type FakeAdminConfigStore struct {
	mtx     sync.Mutex
	Configs map[int64]*models.AdminConfiguration
}

func (f *FakeAdminConfigStore) GetAdminConfiguration(orgID int64) (*models.AdminConfiguration, error) {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	return f.Configs[orgID], nil
}

func (f *FakeAdminConfigStore) GetAdminConfigurations() ([]*models.AdminConfiguration, error) {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	acs := make([]*models.AdminConfiguration, 0, len(f.Configs))
	for _, ac := range f.Configs {
		acs = append(acs, ac)
	}

	return acs, nil
}

func (f *FakeAdminConfigStore) DeleteAdminConfiguration(orgID int64) error {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	delete(f.Configs, orgID)
	return nil
}
func (f *FakeAdminConfigStore) UpdateAdminConfiguration(cmd UpdateAdminConfigurationCmd) error {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	f.Configs[cmd.AdminConfiguration.OrgID] = cmd.AdminConfiguration

	return nil
}

type FakeExternalAlertmanager struct {
	t      *testing.T
	mtx    sync.Mutex
	alerts amv2.PostableAlerts
	Server *httptest.Server
}

func NewFakeExternalAlertmanager(t *testing.T) *FakeExternalAlertmanager {
	t.Helper()

	am := &FakeExternalAlertmanager{
		t:      t,
		alerts: amv2.PostableAlerts{},
	}
	am.Server = httptest.NewServer(http.HandlerFunc(am.Handler()))

	return am
}

func (am *FakeExternalAlertmanager) URL() string {
	return am.Server.URL
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
	am.Server.Close()
}

type FakeAnnotationsRepo struct {
	mtx   sync.Mutex
	Items []*annotations.Item
}

func NewFakeAnnotationsRepo() *FakeAnnotationsRepo {
	return &FakeAnnotationsRepo{
		Items: make([]*annotations.Item, 0),
	}
}

func (repo *FakeAnnotationsRepo) Len() int {
	repo.mtx.Lock()
	defer repo.mtx.Unlock()
	return len(repo.Items)
}

func (repo *FakeAnnotationsRepo) Delete(params *annotations.DeleteParams) error {
	return nil
}

func (repo *FakeAnnotationsRepo) Save(item *annotations.Item) error {
	repo.mtx.Lock()
	defer repo.mtx.Unlock()
	repo.Items = append(repo.Items, item)

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
