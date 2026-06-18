package annotation

import (
	"strconv"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// LabelKeyLegacyID is the annotation-specific label key for legacy numeric IDs.
// This provides backward compatibility with the old annotation API's numeric ID
// while the platform migrates to Kubernetes-native naming.
const LabelKeyLegacyID = "grafana.app/legacyID"

// AnnotationKeyLegacyData is an annotation key used to store raw JSON
// associated with a legacy annotation data on the Kubernetes object.
const AnnotationKeyLegacyData = "grafana.app/legacyData"

// getLegacyID reads the legacy numeric ID from the object's labels.
// Returns 0 if the label is absent or unparseable.
func getLegacyID(obj metav1.Object) int64 {
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

// setLegacyID writes the legacy numeric ID label on the object.
func setLegacyID(obj metav1.Object, id int64) {
	labels := obj.GetLabels()
	if labels == nil {
		labels = make(map[string]string, 1)
	}
	labels[LabelKeyLegacyID] = strconv.FormatInt(id, 10)
	obj.SetLabels(labels)
}

// getLegacyData reads the grafana.app/legacyData annotation from the object.
// The boolean reports whether the annotation was present, letting callers
// distinguish an omitted value (preserve existing) from an explicit empty
// value (clear) — mirroring the legacy API's omitted-vs-null data semantics.
func getLegacyData(obj metav1.Object) (string, bool) {
	annotations := obj.GetAnnotations()
	if annotations == nil {
		return "", false
	}
	v, ok := annotations[AnnotationKeyLegacyData]
	return v, ok
}

// setLegacyData writes the given data string to the grafana.app/legacyData
// annotation on the object. An empty string is written verbatim so callers can
// signal an explicit clear.
func setLegacyData(obj metav1.Object, data string) {
	annotations := obj.GetAnnotations()
	if annotations == nil {
		annotations = make(map[string]string, 1)
	}
	annotations[AnnotationKeyLegacyData] = data
	obj.SetAnnotations(annotations)
}
