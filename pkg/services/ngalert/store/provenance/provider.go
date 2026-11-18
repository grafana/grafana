package provenance

import (
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

// ProvenanceStore persists provisioning provenance and manager properties for arbitrary
// alerting objects in the provenance_type table.
type ProvenanceStore struct {
	FeatureToggles featuremgmt.FeatureToggles
	SQLStore       db.DB
	Logger         log.Logger
}

func ProvideProvenanceStore(
	featureToggles featuremgmt.FeatureToggles,
	sqlstore db.DB,
) *ProvenanceStore {
	return &ProvenanceStore{
		FeatureToggles: featureToggles,
		SQLStore:       sqlstore,
		Logger:         log.New("ngalert.provenancestore"),
	}
}
