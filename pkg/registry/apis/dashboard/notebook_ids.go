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
// is.
//
// An item without one is matched to the stored item with the same element name, and inherits its id,
// but only when no item in the write carries an id. A write with no ids at all comes from a client that
// does not know about them (an older editor tab, a script), and the element name is all it has to say
// which cell is which, so a cell it sends under a stored name is the stored cell edited in place. That
// is a guess: a cell deleted and a different one added under its name in the same write looks
// identical, and inherits the deleted cell's id. A client that sends ids says which cells are which, so
// when any item carries one, an item without is a new cell whatever it is called.
//
// An item that matches nothing gets a new id. An id is never given to two items.
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
	// otherwise swap their ids. Every stored id for a name, in layout order, because layout items may
	// share an element name and each of them has an id to keep.
	var storedIDs map[string][]string
	if len(taken) == 0 && old != nil {
		storedIDs = map[string][]string{}
		for _, cell := range old.Spec.Layout.Spec.Cells {
			if id := notebookCellID(cell); id != "" {
				name := cell.Spec.Element.Name
				storedIDs[name] = append(storedIDs[name], id)
			}
		}
	}

	for i := range cells {
		if notebookCellID(cells[i]) != "" {
			continue
		}

		id, inherited := takeStoredID(storedIDs, cells[i].Spec.Element.Name, taken)
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

// takeStoredID hands out the next stored id for the element name that nothing has claimed, and removes
// it from the list so a second cell with the same name gets the next one.
func takeStoredID(storedIDs map[string][]string, name string, taken map[string]struct{}) (string, bool) {
	ids := storedIDs[name]
	for len(ids) > 0 {
		id := ids[0]
		ids = ids[1:]
		storedIDs[name] = ids
		if _, claimed := taken[id]; !claimed {
			return id, true
		}
	}
	return "", false
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
