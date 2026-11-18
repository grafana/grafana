package manager

import (
	"testing"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/secrets/manager/managertest"
)

func SetupTestService(tb testing.TB, store secrets.Store) *SecretsService {
	return managertest.SetupService(ProvideSecretsService, tb, store)
}

func setupTestService(tb testing.TB, store secrets.Store, features featuremgmt.FeatureToggles) *SecretsService {
	return managertest.SetupServiceWithFeatures(ProvideSecretsService, tb, store, features)
}
