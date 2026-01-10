package provisioning

import (
	"fmt"

	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/generic"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// RepositoryToSelectableFields returns a field set that can be used for field selectors.
// This includes standard metadata fields plus custom fields like spec.connection.name.
func RepositoryToSelectableFields(obj *provisioning.Repository) fields.Set {
	objectMetaFields := generic.ObjectMetaFieldsSet(&obj.ObjectMeta, true)

	// Add custom selectable fields
	specificFields := fields.Set{
		"spec.connection.name": getConnectionName(obj),
	}

	return generic.MergeFieldsSets(objectMetaFields, specificFields)
}

// getConnectionName safely extracts the connection name from a Repository.
// Returns empty string if no connection is configured.
func getConnectionName(obj *provisioning.Repository) string {
	if obj == nil || obj.Spec.Connection == nil {
		return ""
	}
	return obj.Spec.Connection.Name
}

// RepositoryGetAttrs returns labels and fields of a Repository object.
// This is used by the storage layer for filtering.
func RepositoryGetAttrs(obj runtime.Object) (labels.Set, fields.Set, error) {
	repo, ok := obj.(*provisioning.Repository)
	if !ok {
		return nil, nil, fmt.Errorf("given object is not a Repository")
	}
	return labels.Set(repo.Labels), RepositoryToSelectableFields(repo), nil
}
