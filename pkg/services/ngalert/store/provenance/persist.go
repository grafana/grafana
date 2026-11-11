package provenance

import (
	"context"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

// ProvenanceReader reads provisioning provenance.
type ProvenanceReader interface {
	GetProvenance(ctx context.Context, o models.Provisionable, org int64) (models.Provenance, error)
	GetProvenances(ctx context.Context, org int64, resourceType string) (map[string]models.Provenance, error)
	GetProvenancesByUIDs(ctx context.Context, org int64, resourceType string, uids []string) (map[string]models.Provenance, error)
}

// ProvenanceWriter writes provisioning provenance.
type ProvenanceWriter interface {
	SetProvenance(ctx context.Context, o models.Provisionable, org int64, p models.Provenance) error
	DeleteProvenance(ctx context.Context, o models.Provisionable, org int64) error
}

// ManagerPropertiesStore reads and writes the richer manager properties (kind + identity) used by
// app-platform consumers, keeping the legacy provenance column in sync.
type ManagerPropertiesStore interface {
	GetManagerProperties(ctx context.Context, o models.Provisionable, org int64) (utils.ManagerProperties, error)
	GetAllManagerProperties(ctx context.Context, org int64, resourceType string) (map[string]utils.ManagerProperties, error)
	SetManagerProperties(ctx context.Context, o models.Provisionable, org int64, m utils.ManagerProperties) error
}

// store is the full surface implemented by *ProvenanceStore.
type store interface {
	ProvenanceReader
	ProvenanceWriter
	ManagerPropertiesStore
}

var (
	_ store = (*ProvenanceStore)(nil)
	_ store = ProvenanceStore{}
)
