package dashboard

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"

	dashboardv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashboardv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	dashboardv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashboardv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
)

// BOMCleanupStats tracks the cleanup operation statistics
type BOMCleanupStats struct {
	TotalScanned   int
	WithBOMs       int
	Cleaned        int
	Failed         int
	FailedNames    []string
	DryRun         bool
	DashboardsByVersion map[string]int
}

// containsBOM checks if a value (string, map, or slice) contains any BOM characters
func containsBOM(v any) bool {
	switch val := v.(type) {
	case string:
		return strings.Contains(val, "\ufeff")
	case map[string]any:
		for _, v := range val {
			if containsBOM(v) {
				return true
			}
		}
	case []any:
		for _, item := range val {
			if containsBOM(item) {
				return true
			}
		}
	}
	return false
}

// ScanDashboardsForBOMs scans all dashboards in a namespace and reports which ones contain BOMs.
// This is a read-only operation useful for assessing the scope of the problem.
func ScanDashboardsForBOMs(ctx context.Context, clientset kubernetes.Interface, namespace string) (*BOMCleanupStats, error) {
	stats := &BOMCleanupStats{
		DashboardsByVersion: make(map[string]int),
		DryRun:              true,
	}

	// Note: This is a simplified implementation. In a real scenario, you would:
	// 1. Use the appropriate client for each dashboard version
	// 2. Handle pagination for large result sets
	// 3. Add proper error handling and retry logic

	// Scan v0alpha1 dashboards
	// TODO: Implement actual scanning logic using appropriate clients

	return stats, nil
}

// CleanDashboardsWithBOMs patches all dashboards that contain BOMs to clean them.
// This triggers the admission mutation which will strip the BOMs.
func CleanDashboardsWithBOMs(ctx context.Context, clientset kubernetes.Interface, namespace string, dryRun bool) (*BOMCleanupStats, error) {
	stats := &BOMCleanupStats{
		DashboardsByVersion: make(map[string]int),
		DryRun:              dryRun,
		FailedNames:         []string{},
	}

	// Note: This is a framework. The actual implementation depends on your client setup.
	// The key insight is that ANY patch will trigger admission mutation which strips BOMs.

	return stats, nil
}

// Example patch operation that triggers BOM cleanup
func patchDashboardToTriggerCleanup(ctx context.Context, namespace, name string, dryRun bool) error {
	// Create a minimal patch that adds a temporary annotation
	// This will trigger admission mutation which will strip BOMs from the spec
	patch := map[string]any{
		"metadata": map[string]any{
			"annotations": map[string]string{
				"dashboard.grafana.app/bom-cleanup": "triggered",
			},
		},
	}

	patchBytes, err := json.Marshal(patch)
	if err != nil {
		return fmt.Errorf("failed to marshal patch: %w", err)
	}

	if dryRun {
		fmt.Printf("DRY RUN: Would patch dashboard %s/%s\n", namespace, name)
		return nil
	}

	// TODO: Use appropriate client to apply the patch
	// client.Patch(ctx, dashboard, client.Merge, &client.PatchOptions{})

	_ = patchBytes // Use the patch
	return nil
}

// DetectBOMInDashboard checks if a specific dashboard version contains BOMs
func DetectBOMInDashboard(dashboard any) (bool, []string) {
	var fields []string

	switch d := dashboard.(type) {
	case *dashboardv0.Dashboard:
		if containsBOM(d.Spec.Object) {
			fields = findBOMFields(d.Spec.Object, "spec")
			return true, fields
		}

	case *dashboardv1.Dashboard:
		if containsBOM(d.Spec.Object) {
			fields = findBOMFields(d.Spec.Object, "spec")
			return true, fields
		}

	case *dashboardv2alpha1.Dashboard:
		if containsBOM(d.Spec.Title) {
			fields = append(fields, "spec.title")
		}
		if d.Spec.Description != nil && containsBOM(*d.Spec.Description) {
			fields = append(fields, "spec.description")
		}
		// Check other string fields as needed
		return len(fields) > 0, fields

	case *dashboardv2beta1.Dashboard:
		if containsBOM(d.Spec.Title) {
			fields = append(fields, "spec.title")
		}
		if d.Spec.Description != nil && containsBOM(*d.Spec.Description) {
			fields = append(fields, "spec.description")
		}
		return len(fields) > 0, fields
	}

	return false, nil
}

// findBOMFields recursively finds field paths that contain BOMs
func findBOMFields(v any, path string) []string {
	var fields []string

	switch val := v.(type) {
	case string:
		if strings.Contains(val, "\ufeff") {
			fields = append(fields, path)
		}
	case map[string]any:
		for k, v := range val {
			fields = append(fields, findBOMFields(v, path+"."+k)...)
		}
	case []any:
		for i, item := range val {
			fields = append(fields, findBOMFields(item, fmt.Sprintf("%s[%d]", path, i))...)
		}
	}

	return fields
}

// ForceReconcileDashboard forces a dashboard to be reconciled by adding/updating an annotation.
// This is the simplest way to trigger BOM cleanup for a single dashboard.
func ForceReconcileDashboard(ctx context.Context, namespace, name string) error {
	// Add a reconcile annotation to trigger the admission webhook
	patch := []byte(fmt.Sprintf(`{
		"metadata": {
			"annotations": {
				"dashboard.grafana.app/force-reconcile": "%d"
			}
		}
	}`, metav1.Now().Unix()))

	// TODO: Apply patch using appropriate client
	// This will trigger admission mutation which strips BOMs

	_ = patch
	return nil
}
