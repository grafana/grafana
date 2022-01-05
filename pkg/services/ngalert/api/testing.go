package api

import (
	"testing"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
)

type FakeAlertingStore struct {
	orgsWithConfig map[int64]bool
}

func newFakeAlertingStore(t *testing.T) FakeAlertingStore {
	t.Helper()

	return FakeAlertingStore{
		orgsWithConfig: map[int64]bool{},
	}
}

func (f FakeAlertingStore) Setup(orgID int64) {
	f.orgsWithConfig[orgID] = true
}

func (f FakeAlertingStore) GetLatestAlertmanagerConfiguration(query *models.GetLatestAlertmanagerConfigurationQuery) error {
	if _, ok := f.orgsWithConfig[query.OrgID]; ok {
		return nil
	}
	return store.ErrNoAlertmanagerConfiguration
}
