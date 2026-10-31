package resourcepermission

import (
	"context"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/client-go/dynamic"
)

// AddMissingPermissions appends the default entries whose subject (kind and name) has no entry in
// existing yet, and writes the result back. Entries already on the object are never changed or
// removed, so a resource that arrived at the root folder with permissions of its own keeps them
// exactly as they are and only gains the defaults nobody had granted. When every default subject
// already has an entry, nothing is written.
//
// Both the dashboard and the folder default-permission setters call this when
// apistore.KeepExistingPermissions is set on the context.
func AddMissingPermissions(ctx context.Context, client dynamic.ResourceInterface, existing *unstructured.Unstructured, defaults []map[string]any) error {
	current, _, err := unstructured.NestedSlice(existing.Object, "spec", "permissions")
	if err != nil {
		return fmt.Errorf("read existing permissions: %w", err)
	}

	merged, changed := mergeMissingPermissions(current, defaults)
	if !changed {
		return nil
	}

	if err := unstructured.SetNestedSlice(existing.Object, merged, "spec", "permissions"); err != nil {
		return fmt.Errorf("set permissions: %w", err)
	}
	if _, err := client.Update(ctx, existing, metav1.UpdateOptions{}); err != nil {
		return fmt.Errorf("update permissions: %w", err)
	}
	return nil
}

// mergeMissingPermissions returns current with the defaults that have no entry for their subject
// appended, and reports whether anything was appended. A subject is the (kind, name) pair, so an
// existing grant at a different verb still counts as present and is left at its own level.
func mergeMissingPermissions(current []any, defaults []map[string]any) ([]any, bool) {
	type subject struct{ kind, name string }
	assigned := make(map[subject]bool, len(current))
	for _, p := range current {
		entry, ok := p.(map[string]any)
		if !ok {
			continue
		}
		kind, _ := entry["kind"].(string)
		name, _ := entry["name"].(string)
		assigned[subject{kind, name}] = true
	}

	changed := false
	for _, p := range defaults {
		kind, _ := p["kind"].(string)
		name, _ := p["name"].(string)
		if assigned[subject{kind, name}] {
			continue
		}
		// SetNestedSlice deep-copies the slice it is given, so appending the caller's map is
		// safe, but take a copy anyway: the default lists are package-level values.
		copied := make(map[string]any, len(p))
		for k, val := range p {
			copied[k] = val
		}
		current = append(current, copied)
		assigned[subject{kind, name}] = true
		changed = true
	}
	return current, changed
}
