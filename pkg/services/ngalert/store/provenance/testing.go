package provenance

import (
	"testing"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

func SetupStoreForTesting(t *testing.T, db db.DB) *ProvenanceStore {
	t.Helper()
	return &ProvenanceStore{
		FeatureToggles: featuremgmt.WithFeatures(),
		SQLStore:       db,
		Logger:         &logtest.Fake{},
	}
}
