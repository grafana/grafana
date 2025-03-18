package schedule

import (
	"context"
	"slices"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/mock"

	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

// waitForTimeChannel blocks the execution until either the channel ch has some data or a timeout of 10 second expires.
// Timeout will cause the test to fail.
// Returns the data from the channel.
func waitForTimeChannel(t *testing.T, ch chan time.Time) time.Time {
	t.Helper()
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

type fakeRulesStore struct {
	rules map[string]*models.AlertRule
}

func newFakeRulesStore() *fakeRulesStore {
	return &fakeRulesStore{
		rules: map[string]*models.AlertRule{},
	}
}

func (f *fakeRulesStore) GetAlertRulesKeysForScheduling(ctx context.Context) ([]models.AlertRuleKeyWithVersion, error) {
	result := make([]models.AlertRuleKeyWithVersion, 0, len(f.rules))
	for _, rule := range f.rules {
		result = append(result, models.AlertRuleKeyWithVersion{
			Version:      rule.Version,
			AlertRuleKey: rule.GetKey(),
		})
	}
	return result, nil
}

func (f *fakeRulesStore) GetAlertRulesForScheduling(ctx context.Context, query *models.GetAlertRulesForSchedulingQuery) error {
	query.ResultFoldersTitles = map[models.FolderKey]string{}
	for _, rule := range f.rules {
		query.ResultRules = append(query.ResultRules, rule)
		key := models.FolderKey{OrgID: rule.OrgID, UID: rule.NamespaceUID}
		query.ResultFoldersTitles[key] = f.getNamespaceTitle(rule.NamespaceUID)
	}
	return nil
}

func (f *fakeRulesStore) PutRule(_ context.Context, rules ...*models.AlertRule) {
	for _, r := range rules {
		f.rules[r.UID] = r
	}
}

func (f *fakeRulesStore) DeleteRule(rules ...*models.AlertRule) {
	for _, r := range rules {
		delete(f.rules, r.UID)
	}
}

func (f *fakeRulesStore) getNamespaceTitle(uid string) string {
	return "TEST-FOLDER-" + uid
}

type SyncAlertsSenderMock struct {
	*AlertsSenderMock
	mu sync.Mutex
}

func NewSyncAlertsSenderMock() *SyncAlertsSenderMock {
	return &SyncAlertsSenderMock{
		AlertsSenderMock: new(AlertsSenderMock),
	}
}

func (m *SyncAlertsSenderMock) Send(ctx context.Context, key models.AlertRuleKey, alerts definitions.PostableAlerts) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.AlertsSenderMock.Send(ctx, key, alerts)
}

func (m *SyncAlertsSenderMock) Calls() []mock.Call {
	m.mu.Lock()
	defer m.mu.Unlock()
	return slices.Clone(m.AlertsSenderMock.Calls)
}
