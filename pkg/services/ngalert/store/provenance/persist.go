package provenance

import (
	"context"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

// The interfaces below are copies of the consumer-side declarations that *store.DBstore used to
// satisfy implicitly, before the provenance store was extracted into this package. Each segment
// records where the original lives so the two can be kept in sync; the consumers keep owning their
// own interfaces, and Store exists so that a dropped method fails here at compile time rather than
// at some distant call site.

// ProvenanceReader reads provisioning provenance.
//
// Source: pkg/services/ngalert/provisioning/persist.go (ProvisioningStore)
// Source: pkg/services/ngalert/api/prometheus/api_prometheus.go (ProvenanceStore)
// Source: pkg/services/ngalert/notifier/alertmanager_config.go (provisioningStore)
// Source: pkg/services/ngalert/notifier/receiver_svc.go (provisoningStore)
// Source: pkg/services/ngalert/notifier/routes/service.go (routeProvenanceStore)
type ProvenanceReader interface {
	GetProvenance(ctx context.Context, o models.Provisionable, org int64) (models.Provenance, error)
	GetProvenances(ctx context.Context, org int64, resourceType string) (map[string]models.Provenance, error)
	GetProvenancesByUIDs(ctx context.Context, org int64, resourceType string, uids []string) (map[string]models.Provenance, error)
}

// ProvenanceWriter writes provisioning provenance.
//
// Source: pkg/services/ngalert/provisioning/persist.go (ProvisioningStore)
// Source: pkg/services/ngalert/notifier/alertmanager_config.go (provisioningStore)
// Source: pkg/services/ngalert/notifier/receiver_svc.go (provisoningStore)
// Source: pkg/services/ngalert/notifier/routes/service.go (routeProvenanceStore)
type ProvenanceWriter interface {
	SetProvenance(ctx context.Context, o models.Provisionable, org int64, p models.Provenance) error
	DeleteProvenance(ctx context.Context, o models.Provisionable, org int64) error
}

// ManagerPropertiesStore reads and writes the richer manager properties (kind + identity) used by
// app-platform consumers, keeping the legacy provenance column in sync.
//
// Source: pkg/services/ngalert/provisioning/persist.go (ProvisioningStore)
// Source: pkg/services/ngalert/notifier/alertmanager_config.go (provisioningStore)
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
