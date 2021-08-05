package schedule

import (
	"encoding/json"
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	models2 "github.com/grafana/grafana/pkg/models"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/util"

	amv2 "github.com/prometheus/alertmanager/api/v2/models"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newFakeRuleStore(t *testing.T) *fakeRuleStore {
	return &fakeRuleStore{t: t, rules: map[int64]map[string]map[string][]*models.AlertRule{}}
}

// FakeRuleStore mocks the RuleStore of the scheduler.
type fakeRuleStore struct {
	t     *testing.T
	mtx   sync.Mutex
	rules map[int64]map[string]map[string][]*models.AlertRule
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

	for _, rg := range f.rules {
		for _, n := range rg {
			for _, r := range n {
				q.Result = append(q.Result, r...)
			}
		}
	}

	return nil
}
func (f *fakeRuleStore) GetOrgAlertRules(_ *models.ListAlertRulesQuery) error { return nil }
func (f *fakeRuleStore) GetNamespaceAlertRules(_ *models.ListNamespaceAlertRulesQuery) error {
	return nil
}
func (f *fakeRuleStore) GetRuleGroupAlertRules(q *models.ListRuleGroupAlertRulesQuery) error {
	f.mtx.Lock()
	defer f.mtx.Unlock()
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
func (f *fakeRuleStore) GetNamespaces(_ int64, _ *models2.SignedInUser) (map[string]*models2.Folder, error) {
	return nil, nil
}
func (f *fakeRuleStore) GetNamespaceByTitle(_ string, _ int64, _ *models2.SignedInUser, _ bool) (*models2.Folder, error) {
	return nil, nil
}
func (f *fakeRuleStore) GetOrgRuleGroups(_ *models.ListOrgRuleGroupsQuery) error { return nil }
func (f *fakeRuleStore) UpsertAlertRules(_ []store.UpsertRule) error             { return nil }
func (f *fakeRuleStore) UpdateRuleGroup(cmd store.UpdateRuleGroupCmd) error {
	f.mtx.Lock()
	defer f.mtx.Unlock()
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
		//TODO: Not sure why this is not being set properly, where is the code that sets this?
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

type fakeInstanceStore struct{}

func (f *fakeInstanceStore) GetAlertInstance(_ *models.GetAlertInstanceQuery) error     { return nil }
func (f *fakeInstanceStore) ListAlertInstances(_ *models.ListAlertInstancesQuery) error { return nil }
func (f *fakeInstanceStore) SaveAlertInstance(_ *models.SaveAlertInstanceCommand) error { return nil }
func (f *fakeInstanceStore) FetchOrgIds() ([]int64, error)                              { return []int64{}, nil }
func (f *fakeInstanceStore) DeleteAlertInstance(_ int64, _, _ string) error             { return nil }

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

// fakeNotifier represents a fake internal Alertmanager.
type fakeNotifier struct{}

func (n *fakeNotifier) PutAlerts(alerts apimodels.PostableAlerts) error {
	return nil
}

type fakeExternalAlertmanager struct {
	t      *testing.T
	mtx    sync.Mutex
	alerts amv2.PostableAlerts
	server *httptest.Server
}

func newFakeExternalAlertmanager(t *testing.T) *fakeExternalAlertmanager {
	t.Helper()

	am := &fakeExternalAlertmanager{
		t:      t,
		alerts: amv2.PostableAlerts{},
	}
	am.server = httptest.NewServer(http.HandlerFunc(am.Handler()))

	return am
}

func (am *fakeExternalAlertmanager) AlertNamesCompare(expected []string) bool {
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

func (am *fakeExternalAlertmanager) AlertsCount() int {
	am.mtx.Lock()
	defer am.mtx.Unlock()

	return len(am.alerts)
}

func (am *fakeExternalAlertmanager) Alerts() amv2.PostableAlerts {
	am.mtx.Lock()
	defer am.mtx.Unlock()
	return am.alerts
}

func (am *fakeExternalAlertmanager) Handler() func(w http.ResponseWriter, r *http.Request) {
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

func (am *fakeExternalAlertmanager) Close() {
	am.server.Close()
}
