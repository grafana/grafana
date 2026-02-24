package migrations

import (
	"context"
	"sync"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/util/xorm"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// Validator interface validates migration results.
type Validator interface {
	Name() string
	Validate(ctx context.Context, sess *xorm.Session, response *resourcepb.BulkResponse, log log.Logger) error
}

// ValidatorFactory creates a validator when given the runtime dependencies.
// This allows validator configuration to be defined at registration time,
// while actual validator instances are created when dependencies are available.
type ValidatorFactory func(client resourcepb.ResourceIndexClient, driverName string) Validator

// MigratorFunc is the signature for resource migration functions.
type MigratorFunc = func(ctx context.Context, orgId int64, opts MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) error

// ResourceInfo extends GroupResource with additional metadata needed for migration.
type ResourceInfo struct {
	schema.GroupResource
	// LockTables are the legacy database tables to lock during migration.
	// This must include every table the migrator reads from.
	LockTables []string
}

// MigrationDefinition defines a resource migration.
// This is the public API for defining and registering migrations.
type MigrationDefinition struct {
	ID          string                                // Unique identifier for registry lookup (e.g., "folders-dashboards", "playlists")
	MigrationID string                                // ID for the migration log table entry (e.g., "folders and dashboards migration")
	Resources   []ResourceInfo                        // Resources to migrate together, with their lock tables
	Migrators   map[schema.GroupResource]MigratorFunc // Direct migrator functions per resource
	Validators  []ValidatorFactory                    // Validator factories (validators created lazily)
}

// CreateValidators creates validators from the stored factory functions.
func (d MigrationDefinition) CreateValidators(client resourcepb.ResourceIndexClient, driverName string) []Validator {
	validators := make([]Validator, 0, len(d.Validators))
	for _, factory := range d.Validators {
		validators = append(validators, factory(client, driverName))
	}
	return validators
}

// ConfigResources returns the resource identifiers in the format used by setting.UnifiedStorage config.
// The format is "resource.group" (e.g., "dashboards.dashboard.grafana.app").
func (d MigrationDefinition) ConfigResources() []string {
	result := make([]string, len(d.Resources))
	for i, ri := range d.Resources {
		result[i] = ri.Resource + "." + ri.Group
	}
	return result
}

// GetGroupResources returns just the GroupResource slice for compatibility with existing code.
func (d MigrationDefinition) GetGroupResources() []schema.GroupResource {
	result := make([]schema.GroupResource, len(d.Resources))
	for i, ri := range d.Resources {
		result[i] = ri.GroupResource
	}
	return result
}

// GetLockTables returns the lock tables for a given GroupResource.
func (d MigrationDefinition) GetLockTables(gr schema.GroupResource) []string {
	for _, ri := range d.Resources {
		if ri.GroupResource == gr {
			return ri.LockTables
		}
	}
	return nil
}

// GetMigratorFunc returns the migrator function for a given resource.
func (d MigrationDefinition) GetMigratorFunc(gr schema.GroupResource) MigratorFunc {
	return d.Migrators[gr]
}

// MigrationRegistry is a thread-safe registry of migration definitions.
type MigrationRegistry struct {
	mu          sync.RWMutex
	definitions map[string]MigrationDefinition
	order       []string // Maintains insertion order for iteration
}

// NewMigrationRegistry creates a new empty migration registry.
func NewMigrationRegistry() *MigrationRegistry {
	return &MigrationRegistry{
		definitions: make(map[string]MigrationDefinition),
		order:       make([]string, 0),
	}
}

// Register adds a migration definition to the registry.
func (r *MigrationRegistry) Register(def MigrationDefinition) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, exists := r.definitions[def.ID]; !exists {
		r.order = append(r.order, def.ID)
	} else if exists {
		panic("migration definition with ID " + def.ID + " is already registered")
	}
	r.definitions[def.ID] = def
}

// Get retrieves a migration definition by ID.
func (r *MigrationRegistry) Get(id string) (MigrationDefinition, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	def, ok := r.definitions[id]
	return def, ok
}

// All returns all registered migration definitions in registration order.
func (r *MigrationRegistry) All() []MigrationDefinition {
	r.mu.RLock()
	defer r.mu.RUnlock()
	result := make([]MigrationDefinition, 0, len(r.order))
	for _, id := range r.order {
		if def, ok := r.definitions[id]; ok {
			result = append(result, def)
		}
	}
	return result
}

// GetMigratorFunc searches all definitions for a migrator matching the given resource.
func (r *MigrationRegistry) GetMigratorFunc(gr schema.GroupResource) MigratorFunc {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for _, def := range r.definitions {
		if fn := def.GetMigratorFunc(gr); fn != nil {
			return fn
		}
	}
	return nil
}

// GetLockTables returns the legacy table names for a resource, if registered.
func (r *MigrationRegistry) GetLockTables(gr schema.GroupResource) []string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for _, def := range r.definitions {
		if tables := def.GetLockTables(gr); len(tables) > 0 {
			return tables
		}
	}
	return nil
}

// HasResource checks if a resource is registered in any migration definition.
func (r *MigrationRegistry) HasResource(gr schema.GroupResource) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for _, def := range r.definitions {
		if _, ok := def.Migrators[gr]; ok {
			return true
		}
	}
	return false
}
