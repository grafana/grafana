package migrations

import (
	"context"
	"sync"

	v1beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	playlists "github.com/grafana/grafana/apps/playlist/pkg/apis/playlist/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/util/xorm"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// Validator interface validates migration results.
type Validator interface {
	Name() string
	Validate(ctx context.Context, sess *xorm.Session, response *resourcepb.BulkResponse, log log.Logger) error
}

// ValidatorFactory creates a validator with the given context.
type ValidatorFactory func(client resourcepb.ResourceIndexClient, driverName string) Validator

// MigratorFunc is the signature for resource migration functions.
type MigratorFunc = func(ctx context.Context, orgId int64, opts legacy.MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) error

// MigratorFactory creates a migrator function given an accessor.
// This allows the registry to store type-safe method references without
// requiring the accessor at registration time.
type MigratorFactory func(accessor legacy.MigrationDashboardAccessor) MigratorFunc

// ResourceInfo extends GroupResource with additional metadata needed for migration.
type ResourceInfo struct {
	schema.GroupResource
	// LockTable is the legacy database table to lock during migration.
	// This is required for all migrations that modify data.
	LockTable string
}

// MigrationDefinition defines a resource migration.
// This is the public API for defining and registering migrations.
type MigrationDefinition struct {
	ID          string                                   // Unique identifier for registry lookup (e.g., "folders-dashboards", "playlists")
	MigrationID string                                   // ID for the migration log table entry (e.g., "folders and dashboards migration")
	Resources   []ResourceInfo                           // Resources to migrate together, with their lock tables
	Migrators   map[schema.GroupResource]MigratorFactory // Type-safe migrator factories per resource
	Validators  []ValidatorFactory                       // Optional validator factories
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

// GetLockTable returns the lock table for a given GroupResource, or empty string if not found.
func (d MigrationDefinition) GetLockTable(gr schema.GroupResource) string {
	for _, ri := range d.Resources {
		if ri.GroupResource == gr {
			return ri.LockTable
		}
	}
	return ""
}

// CreateValidators instantiates validators with the provided runtime dependencies.
func (d MigrationDefinition) CreateValidators(client resourcepb.ResourceIndexClient, driverName string) []Validator {
	validators := make([]Validator, 0, len(d.Validators))
	for _, factory := range d.Validators {
		validators = append(validators, factory(client, driverName))
	}
	return validators
}

// GetMigratorFunc returns the migrator function for a given resource.
func (d MigrationDefinition) GetMigratorFunc(accessor legacy.MigrationDashboardAccessor, gr schema.GroupResource) MigratorFunc {
	if factory, ok := d.Migrators[gr]; ok {
		return factory(accessor)
	}
	return nil
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
func (r *MigrationRegistry) GetMigratorFunc(accessor legacy.MigrationDashboardAccessor, gr schema.GroupResource) MigratorFunc {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for _, def := range r.definitions {
		if fn := def.GetMigratorFunc(accessor, gr); fn != nil {
			return fn
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

// Registry is the public migration registry containing all migration definitions.
// It can be used from other packages to access migrations without the SQL migration interface.
var Registry = NewMigrationRegistry()

func init() {
	// Register folders and dashboards migration
	folderGR := schema.GroupResource{Group: folders.GROUP, Resource: folders.RESOURCE}
	dashboardGR := schema.GroupResource{Group: v1beta1.GROUP, Resource: v1beta1.DASHBOARD_RESOURCE}

	Registry.Register(MigrationDefinition{
		ID:          "folders-dashboards",
		MigrationID: "folders and dashboards migration",
		Resources: []ResourceInfo{
			{GroupResource: folderGR, LockTable: "folder"},
			{GroupResource: dashboardGR, LockTable: "dashboard"},
		},
		Migrators: map[schema.GroupResource]MigratorFactory{
			folderGR:    func(a legacy.MigrationDashboardAccessor) MigratorFunc { return a.MigrateFolders },
			dashboardGR: func(a legacy.MigrationDashboardAccessor) MigratorFunc { return a.MigrateDashboards },
		},
		Validators: []ValidatorFactory{
			CountValidation(folderGR, "dashboard", "org_id = ? AND is_folder = true AND deleted IS NULL"),
			CountValidation(dashboardGR, "dashboard", "org_id = ? AND is_folder = false AND deleted IS NULL"),
			FolderTreeValidation(folderGR),
		},
	})

	// Register playlists migration
	playlistGR := schema.GroupResource{Group: playlists.APIGroup, Resource: "playlists"}

	Registry.Register(MigrationDefinition{
		ID:          "playlists",
		MigrationID: "playlists migration",
		Resources: []ResourceInfo{
			{GroupResource: playlistGR, LockTable: "playlist"},
		},
		Migrators: map[schema.GroupResource]MigratorFactory{
			playlistGR: func(a legacy.MigrationDashboardAccessor) MigratorFunc { return a.MigratePlaylists },
		},
		Validators: []ValidatorFactory{
			CountValidation(playlistGR, "playlist", "org_id = ?"),
		},
	})
}
