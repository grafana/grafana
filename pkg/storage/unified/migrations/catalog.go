package migrations

import "k8s.io/apimachinery/pkg/runtime/schema"

// ResourceDefinition describes a unified storage resource that can be migrated.
type ResourceDefinition struct {
	Group    string
	Resource string
}

// MigrationDefinition groups resources that must be migrated together.
type MigrationDefinition struct {
	Name        string
	MigrationID string
	Resources   []ResourceDefinition
}

// UnifiedStorageMigrationCatalog returns a copy of the built-in migration registry.
func UnifiedStorageMigrationCatalog() []MigrationDefinition {
	catalog := make([]MigrationDefinition, 0, len(migrationRegistry))
	for _, migration := range migrationRegistry {
		catalog = append(catalog, MigrationDefinition{
			Name:        migration.name,
			MigrationID: migration.migrationID,
			Resources:   cloneResourceDefinitions(migration.groupResources),
		})
	}
	return catalog
}

func cloneResourceDefinitions(resources []schema.GroupResource) []ResourceDefinition {
	if len(resources) == 0 {
		return nil
	}
	clone := make([]ResourceDefinition, 0, len(resources))
	for _, res := range resources {
		clone = append(clone, ResourceDefinition{
			Group:    res.Group,
			Resource: res.Resource,
		})
	}
	return clone
}
