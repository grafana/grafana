package snapshot

import (
	"fmt"

	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/generic"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
)

// SnapshotToSelectableFields returns a field set that can be used for field selectors.
// This includes standard metadata fields plus spec.deleteKey.
func SnapshotToSelectableFields(obj *dashv0.Snapshot) fields.Set {
	objectMetaFields := generic.ObjectMetaFieldsSet(&obj.ObjectMeta, true)

	specificFields := fields.Set{
		"spec.deleteKey": getDeleteKey(obj),
	}

	return generic.MergeFieldsSets(objectMetaFields, specificFields)
}

func getDeleteKey(obj *dashv0.Snapshot) string {
	if obj == nil || obj.Spec.DeleteKey == nil {
		return ""
	}
	return *obj.Spec.DeleteKey
}

// SnapshotGetAttrs returns labels and fields of a Snapshot object.
// This is used by the storage layer for filtering.
func SnapshotGetAttrs(obj runtime.Object) (labels.Set, fields.Set, error) {
	snap, ok := obj.(*dashv0.Snapshot)
	if !ok {
		return nil, nil, fmt.Errorf("given object is not a Snapshot")
	}
	return labels.Set(snap.Labels), SnapshotToSelectableFields(snap), nil
}
