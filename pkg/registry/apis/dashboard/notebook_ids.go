package dashboard

import (
	"regexp"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/util/uuid"
	"k8s.io/apimachinery/pkg/util/validation/field"

	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
)

// notebookCellIDPattern is the shape of a UUID v4, which is what newNotebookCellID produces. Anything
// else in a layout item's id is a client making one up.
var notebookCellIDPattern = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`)

// newNotebookCellID is a variable so tests can make ids predictable.
var newNotebookCellID = func() string { return string(uuid.NewUUID()) }

func notebookCellID(item dashv2beta1.NotebookNotebookLayoutItemKind) string {
	if item.Spec.Id == nil {
		return ""
	}
	return *item.Spec.Id
}

// assignNotebookCellIDs gives every layout item an id.
//
// A client names a cell by its element name, and nothing stops it reusing the name of a cell that was
// deleted, or changing it. The id is the one thing about a cell a client does not get to choose, which
// is what comments can safely point at.
//
// An item that arrives with an id keeps it, so renaming a cell's element does not change which cell it
// is. An item that arrives without one inherits the id of the stored item with the same element name:
// that is every client that doesn't know about ids yet, and a client that rebuilds the whole spec. Only
// an item that matches nothing gets a new id. An id is never given to two items.
//
// old is nil on create.
func assignNotebookCellIDs(notebook, old *dashv2beta1.Notebook) {
	cells := notebook.Spec.Layout.Spec.Cells

	taken := make(map[string]struct{}, len(cells))
	for _, cell := range cells {
		if id := notebookCellID(cell); id != "" {
			taken[id] = struct{}{}
		}
	}

	// By element name rather than by position: a client that reorders cells while saving would
	// otherwise swap their ids.
	storedIDs := map[string]string{}
	if old != nil {
		for _, cell := range old.Spec.Layout.Spec.Cells {
			id := notebookCellID(cell)
			if id == "" {
				continue
			}
			if _, seen := storedIDs[cell.Spec.Element.Name]; !seen {
				storedIDs[cell.Spec.Element.Name] = id
			}
		}
	}

	for i := range cells {
		if notebookCellID(cells[i]) != "" {
			continue
		}

		id, inherited := storedIDs[cells[i].Spec.Element.Name]
		if _, claimed := taken[id]; inherited && claimed {
			// The stored id is already on another incoming item, so this one is a different cell that
			// happens to share the element name.
			inherited = false
		}
		if !inherited {
			id = newNotebookCellID()
			for {
				if _, claimed := taken[id]; !claimed {
					break
				}
				id = newNotebookCellID()
			}
		}

		taken[id] = struct{}{}
		cells[i].Spec.Id = &id
	}
}

// validateNotebookCellIDs rejects an id that is malformed or on more than one item. An item without an
// id is fine here: assignNotebookCellIDs runs first on the way in, and a caller validating on its own
// has not asked for ids.
func validateNotebookCellIDs(notebook *dashv2beta1.Notebook) error {
	var errs field.ErrorList

	seen := map[string]struct{}{}
	for i, cell := range notebook.Spec.Layout.Spec.Cells {
		id := notebookCellID(cell)
		if id == "" {
			continue
		}

		path := field.NewPath("spec", "layout", "spec", "cells").Index(i).Child("spec", "id")
		if !notebookCellIDPattern.MatchString(id) {
			errs = append(errs, field.Invalid(path, id, "must be a UUID v4"))
			continue
		}
		if _, duplicate := seen[id]; duplicate {
			errs = append(errs, field.Duplicate(path, id))
			continue
		}
		seen[id] = struct{}{}
	}

	if len(errs) == 0 {
		return nil
	}
	return apierrors.NewInvalid(dashv2beta1.NotebookResourceInfo.GroupVersionKind().GroupKind(), notebook.GetName(), errs)
}
