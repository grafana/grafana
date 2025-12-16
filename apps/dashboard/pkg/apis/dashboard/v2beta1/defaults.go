package v2beta1

import (
	"k8s.io/apimachinery/pkg/runtime"
)

// SetDefaults_Dashboard ensures all panel queries have unique refIds
// This is called by the Kubernetes defaulting mechanism when dashboards are returned
func SetDefaults_Dashboard(obj *Dashboard) {
	EnsureUniqueRefIds(&obj.Spec)
}

// EnsureUniqueRefIds ensures all queries within each panel have unique refIds
// This matches the frontend behavior in PanelModel.ensureQueryIds()
func EnsureUniqueRefIds(spec *DashboardSpec) {
	for _, element := range spec.Elements {
		if element.PanelKind != nil {
			ensureUniqueRefIdsForPanel(element.PanelKind)
		}
	}
}

func ensureUniqueRefIdsForPanel(panel *DashboardPanelKind) {
	queries := panel.Spec.Data.Spec.Queries
	if len(queries) == 0 {
		return
	}

	// First pass: collect existing refIds
	existingRefIds := make(map[string]bool)
	for i := range queries {
		if queries[i].Spec.RefId != "" {
			existingRefIds[queries[i].Spec.RefId] = true
		}
	}

	// Second pass: assign unique refIds to queries without one
	for i := range queries {
		if queries[i].Spec.RefId == "" {
			queries[i].Spec.RefId = getNextRefId(existingRefIds)
			existingRefIds[queries[i].Spec.RefId] = true
		}
	}
}

// getNextRefId generates the next available refId (A, B, C, ..., Z, AA, AB, etc.)
// This matches the frontend behavior in packages/grafana-data/src/query/refId.ts
func getNextRefId(existingRefIds map[string]bool) string {
	for num := 0; ; num++ {
		refId := getRefIdFromNumber(num)
		if !existingRefIds[refId] {
			return refId
		}
	}
}

// getRefIdFromNumber converts a number to a refId (0=A, 1=B, ..., 25=Z, 26=AA, 27=AB, etc.)
func getRefIdFromNumber(num int) string {
	const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
	if num < len(letters) {
		return string(letters[num])
	}
	return getRefIdFromNumber(num/len(letters)-1) + string(letters[num%len(letters)])
}

// RegisterCustomDefaults registers custom defaulting functions for Dashboard types.
// This should be called from RegisterDefaults in zz_generated.defaults.go
// However, since that file is auto-generated, we provide this as a separate registration
func RegisterCustomDefaults(scheme *runtime.Scheme) error {
	scheme.AddTypeDefaultingFunc(&Dashboard{}, func(obj interface{}) {
		SetDefaults_Dashboard(obj.(*Dashboard))
	})
	return nil
}
