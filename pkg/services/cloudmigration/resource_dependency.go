package cloudmigration

import (
	"github.com/grafana/grafana/pkg/apimachinery/errutil"
)

var (
	ErrDuplicateResourceType = errutil.BadRequest("cloudmigrations.duplicateResourceType")
	ErrUnknownResourceType   = errutil.BadRequest("cloudmigrations.unknownResourceType")
	ErrMissingDependency     = errutil.BadRequest("cloudmigrations.missingDependency")
)

// DependencyMap is a map of resource types to their direct dependencies.
type DependencyMap map[MigrateDataType][]MigrateDataType

// baseResourceDependency holds the resources that are always migratable,
// mapped to their direct dependencies.
var baseResourceDependency = DependencyMap{
	PluginDataType:         nil,
	FolderDataType:         nil,
	DatasourceDataType:     {PluginDataType},
	LibraryElementDataType: {FolderDataType},
	DashboardDataType:      {FolderDataType, DatasourceDataType, LibraryElementDataType},
}

// alertingResourceDependency holds the alerting resources, mapped to their
// direct dependencies. These are only migratable when alerting is enabled.
var alertingResourceDependency = DependencyMap{
	MuteTimingType:           nil,
	NotificationTemplateType: nil,
	ContactPointType:         {NotificationTemplateType},
	NotificationPolicyType:   {ContactPointType, MuteTimingType},
	AlertRuleType:            {DatasourceDataType, FolderDataType, DashboardDataType, MuteTimingType, ContactPointType, NotificationPolicyType},
	AlertRuleGroupType:       {AlertRuleType},
}

// ResourceDependency returns the resource dependency graph for the current
// set of migratable resources. Alerting resources are only included when
// alerting is enabled, so that they are neither offered in the UI nor accepted
// by snapshot creation on instances where alerting is disabled.
func ResourceDependency(alertingEnabled bool) DependencyMap {
	depMap := make(DependencyMap, len(baseResourceDependency)+len(alertingResourceDependency))
	for resourceType, dependencies := range baseResourceDependency {
		depMap[resourceType] = dependencies
	}
	if alertingEnabled {
		for resourceType, dependencies := range alertingResourceDependency {
			depMap[resourceType] = dependencies
		}
	}
	return depMap
}

// Parse a raw slice of resource types and returns a set of them if it has all correct dependencies.
func (depMap DependencyMap) Parse(rawInput []MigrateDataType) (ResourceTypes, error) {
	// Clean up any possible duplicates.
	input := make(ResourceTypes, len(rawInput))
	for _, resourceType := range rawInput {
		if _, exists := input[resourceType]; exists {
			return nil, ErrDuplicateResourceType.Errorf("duplicate resource type found: %v", resourceType)
		}
		input[resourceType] = struct{}{}
	}

	// Validate that all dependencies are present.
	for resourceType := range input {
		if err := depMap.validateDependencies(resourceType, input); err != nil {
			return nil, err
		}
	}

	return input, nil
}

// validateDependencies recursively checks if all dependencies for a resource type are present in the input set.
func (depMap DependencyMap) validateDependencies(resourceType MigrateDataType, input ResourceTypes) error {
	// Get the direct dependencies for this resource type.
	dependencies, ok := depMap[resourceType]
	if !ok {
		return ErrUnknownResourceType.Errorf("unknown resource type: %v", resourceType)
	}

	// Make sure all direct dependencies are in the input.
	for _, dep := range dependencies {
		if _, exists := input[dep]; !exists {
			return ErrMissingDependency.Errorf("missing dependency: %v for resource type %v", dep, resourceType)
		}

		// Recursively validate dependencies of dependencies
		if err := depMap.validateDependencies(dep, input); err != nil {
			return err
		}
	}

	return nil
}
