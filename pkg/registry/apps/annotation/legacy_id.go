package annotation

import (
	"strconv"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// LabelKeyLegacyID is the annotation-specific label key for legacy numeric IDs.
// This provides backward compatibility with the old annotation API's numeric ID
// while the platform migrates to Kubernetes-native naming.
const LabelKeyLegacyID = "grafana.app/legacyID"

// GetLegacyID reads the legacy numeric ID from the object's labels.
// Returns 0 if the label is absent or unparseable.
func GetLegacyID(obj metav1.Object) int64 {
	labels := obj.GetLabels()
	if labels == nil {
		return 0
	}
	v, ok := labels[LabelKeyLegacyID]
	if !ok {
		return 0
	}
	id, err := strconv.ParseInt(v, 10, 64)
	if err != nil {
		return 0
	}
	return id
}

// SetLegacyID writes the legacy numeric ID label on the object.
func SetLegacyID(obj metav1.Object, id int64) {
	labels := obj.GetLabels()
	if labels == nil {
		labels = make(map[string]string, 1)
	}
	labels[LabelKeyLegacyID] = strconv.FormatInt(id, 10)
	obj.SetLabels(labels)
}
