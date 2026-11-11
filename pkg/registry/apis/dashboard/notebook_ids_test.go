package dashboard

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
)

// testCellID is a valid UUID v4 that is the same for the same n, so a test can say which id it expects.
func testCellID(n int) string {
	return fmt.Sprintf("00000000-0000-4000-8000-%012d", n)
}

// layoutCell is a layout item for the element, with the given id, or none when id is empty.
func layoutCell(element, id string) dashv2beta1.NotebookNotebookLayoutItemKind {
	cell := *dashv2beta1.NewNotebookNotebookLayoutItemKind()
	cell.Spec.Element.Name = element
	cell.Spec.Source = dashv2beta1.NotebookNotebookLayoutItemSpecSourceUser
	if id != "" {
		cell.Spec.Id = &id
	}
	return cell
}

func notebookWithCells(cells ...dashv2beta1.NotebookNotebookLayoutItemKind) *dashv2beta1.Notebook {
	nb := newNotebook("nb")
	nb.Spec.Layout.Spec.Cells = cells
	return nb
}

func cellIDs(nb *dashv2beta1.Notebook) []string {
	ids := make([]string, 0, len(nb.Spec.Layout.Spec.Cells))
	for _, cell := range nb.Spec.Layout.Spec.Cells {
		ids = append(ids, notebookCellID(cell))
	}
	return ids
}

// sequentialCellIDs makes new ids predictable: testCellID(100), testCellID(101), and so on.
func sequentialCellIDs(t *testing.T) {
	t.Helper()
	next := 100
	original := newNotebookCellID
	newNotebookCellID = func() string {
		id := testCellID(next)
		next++
		return id
	}
	t.Cleanup(func() { newNotebookCellID = original })
}

func TestAssignNotebookCellIDs(t *testing.T) {
	t.Run("a created notebook gets a distinct UUID v4 on every cell", func(t *testing.T) {
		nb := notebookWithCells(layoutCell("a", ""), layoutCell("b", ""), layoutCell("c", ""))

		assignNotebookCellIDs(nb, nil)

		seen := map[string]struct{}{}
		for _, id := range cellIDs(nb) {
			require.Regexp(t, notebookCellIDPattern, id)
			seen[id] = struct{}{}
		}
		require.Len(t, seen, 3)
	})

	t.Run("a cell with no id inherits the id of the stored cell with the same element name", func(t *testing.T) {
		stored := notebookWithCells(layoutCell("a", testCellID(1)), layoutCell("b", testCellID(2)))
		// Reordered too: the match is by element name, not by position.
		nb := notebookWithCells(layoutCell("b", ""), layoutCell("a", ""))

		assignNotebookCellIDs(nb, stored)

		require.Equal(t, []string{testCellID(2), testCellID(1)}, cellIDs(nb))
	})

	t.Run("a cell that arrives with an id keeps it, including when its element was renamed", func(t *testing.T) {
		stored := notebookWithCells(layoutCell("a", testCellID(1)))
		nb := notebookWithCells(layoutCell("renamed", testCellID(1)))

		assignNotebookCellIDs(nb, stored)

		require.Equal(t, []string{testCellID(1)}, cellIDs(nb))
	})

	t.Run("a cell the stored notebook has nothing for gets a new id", func(t *testing.T) {
		sequentialCellIDs(t)
		stored := notebookWithCells(layoutCell("a", testCellID(1)))
		nb := notebookWithCells(layoutCell("a", ""), layoutCell("new", ""))

		assignNotebookCellIDs(nb, stored)

		require.Equal(t, []string{testCellID(1), testCellID(100)}, cellIDs(nb))
	})

	// The reason ids exist: a name freed by a delete is not the same cell when it comes back.
	t.Run("a cell added under the name of a deleted cell does not get the deleted cell's id", func(t *testing.T) {
		sequentialCellIDs(t)
		afterDelete := notebookWithCells(layoutCell("b", testCellID(2)))
		nb := notebookWithCells(layoutCell("a", ""), layoutCell("b", ""))

		assignNotebookCellIDs(nb, afterDelete)

		require.Equal(t, []string{testCellID(100), testCellID(2)}, cellIDs(nb))
	})

	t.Run("a stored id already carried by another incoming cell is not given out twice", func(t *testing.T) {
		sequentialCellIDs(t)
		stored := notebookWithCells(layoutCell("a", testCellID(1)))
		// The id moved to the cell now called "b". The new cell called "a" is a different cell.
		nb := notebookWithCells(layoutCell("b", testCellID(1)), layoutCell("a", ""))

		assignNotebookCellIDs(nb, stored)

		require.Equal(t, []string{testCellID(1), testCellID(100)}, cellIDs(nb))
	})

	t.Run("two cells with the same element name share one stored id only once", func(t *testing.T) {
		sequentialCellIDs(t)
		stored := notebookWithCells(layoutCell("a", testCellID(1)))
		nb := notebookWithCells(layoutCell("a", ""), layoutCell("a", ""))

		assignNotebookCellIDs(nb, stored)

		require.Equal(t, []string{testCellID(1), testCellID(100)}, cellIDs(nb))
	})

	t.Run("a stored notebook that predates ids gives its cells new ids", func(t *testing.T) {
		sequentialCellIDs(t)
		stored := notebookWithCells(layoutCell("a", ""), layoutCell("b", ""))
		nb := notebookWithCells(layoutCell("a", ""), layoutCell("b", ""))

		assignNotebookCellIDs(nb, stored)

		require.Equal(t, []string{testCellID(100), testCellID(101)}, cellIDs(nb))
	})

	t.Run("an id the stored notebook does not have is kept, as when a version is restored", func(t *testing.T) {
		sequentialCellIDs(t)
		stored := notebookWithCells(layoutCell("b", testCellID(2)))
		nb := notebookWithCells(layoutCell("a", testCellID(1)), layoutCell("b", testCellID(2)))

		assignNotebookCellIDs(nb, stored)

		require.Equal(t, []string{testCellID(1), testCellID(2)}, cellIDs(nb))
	})

	// The editor's counter reissues a deleted cell's name. A client that sends ids has said which cells
	// are which, so the new cell is not the deleted one just because it has its name.
	t.Run("a cell without an id in a write that carries ids is new, even under a stored name", func(t *testing.T) {
		sequentialCellIDs(t)
		stored := notebookWithCells(layoutCell("paragraph-1", testCellID(1)), layoutCell("paragraph-2", testCellID(2)))
		nb := notebookWithCells(layoutCell("paragraph-1", testCellID(1)), layoutCell("paragraph-2", ""))

		assignNotebookCellIDs(nb, stored)

		require.Equal(t, []string{testCellID(1), testCellID(100)}, cellIDs(nb))
	})

	// The limit of matching by name: a client that sends no ids at all gives the server nothing but the
	// name, so a cell deleted and re-added under it in one write cannot be told from an edit in place.
	t.Run("a write with no ids at all treats a cell under a stored name as that cell edited in place", func(t *testing.T) {
		stored := notebookWithCells(layoutCell("paragraph-1", testCellID(1)), layoutCell("paragraph-2", testCellID(2)))
		// paragraph-2 was deleted and a different cell added, which the counter named paragraph-2 again.
		nb := notebookWithCells(layoutCell("paragraph-1", ""), layoutCell("paragraph-2", ""))

		assignNotebookCellIDs(nb, stored)

		require.Equal(t, []string{testCellID(1), testCellID(2)}, cellIDs(nb))
	})

	t.Run("cells that share an element name each keep their own stored id, in order", func(t *testing.T) {
		stored := notebookWithCells(layoutCell("a", testCellID(1)), layoutCell("a", testCellID(2)), layoutCell("b", testCellID(3)))
		nb := notebookWithCells(layoutCell("a", ""), layoutCell("a", ""), layoutCell("b", ""))

		assignNotebookCellIDs(nb, stored)

		require.Equal(t, []string{testCellID(1), testCellID(2), testCellID(3)}, cellIDs(nb))
	})

	t.Run("a write that carries any id inherits nothing by name", func(t *testing.T) {
		sequentialCellIDs(t)
		stored := notebookWithCells(layoutCell("a", testCellID(1)), layoutCell("b", testCellID(2)))
		nb := notebookWithCells(layoutCell("a", ""), layoutCell("b", testCellID(2)))

		assignNotebookCellIDs(nb, stored)

		require.Equal(t, []string{testCellID(100), testCellID(2)}, cellIDs(nb))
	})

	t.Run("a new id never collides with one already on the notebook", func(t *testing.T) {
		next := 0
		original := newNotebookCellID
		// Hands out the id the first cell already has before a free one.
		newNotebookCellID = func() string {
			next++
			return testCellID(next)
		}
		t.Cleanup(func() { newNotebookCellID = original })
		nb := notebookWithCells(layoutCell("a", testCellID(1)), layoutCell("b", ""))

		assignNotebookCellIDs(nb, nil)

		require.Equal(t, []string{testCellID(1), testCellID(2)}, cellIDs(nb))
	})

	t.Run("an empty id counts as no id", func(t *testing.T) {
		sequentialCellIDs(t)
		empty := ""
		cell := layoutCell("a", "")
		cell.Spec.Id = &empty
		nb := notebookWithCells(cell)

		assignNotebookCellIDs(nb, nil)

		require.Equal(t, []string{testCellID(100)}, cellIDs(nb))
	})

	t.Run("a notebook without cells is left alone", func(t *testing.T) {
		nb := notebookWithCells()

		assignNotebookCellIDs(nb, notebookWithCells(layoutCell("a", testCellID(1))))

		require.Empty(t, nb.Spec.Layout.Spec.Cells)
	})
}

func TestValidateNotebookCellIDs(t *testing.T) {
	t.Run("a notebook without ids is accepted", func(t *testing.T) {
		require.NoError(t, validateNotebookCellIDs(notebookWithCells(layoutCell("a", ""), layoutCell("b", ""))))
	})

	t.Run("distinct UUID v4 ids are accepted", func(t *testing.T) {
		require.NoError(t, validateNotebookCellIDs(notebookWithCells(layoutCell("a", testCellID(1)), layoutCell("b", testCellID(2)))))
	})

	t.Run("the same id on two cells is rejected, naming the second cell", func(t *testing.T) {
		err := validateNotebookCellIDs(notebookWithCells(layoutCell("a", testCellID(1)), layoutCell("b", testCellID(1))))

		require.True(t, apierrors.IsInvalid(err), "expected an Invalid error, got %v", err)
		require.ErrorContains(t, err, "spec.layout.spec.cells[1].spec.id")
		require.ErrorContains(t, err, "Duplicate")
	})

	for name, id := range map[string]string{
		"an element name":        "heading-1",
		"a UUID of another kind": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
		"uppercase hex":          "00000000-0000-4000-8000-00000000000A",
		"a UUID without dashes":  "00000000000040008000000000000001",
	} {
		t.Run("rejects "+name, func(t *testing.T) {
			err := validateNotebookCellIDs(notebookWithCells(layoutCell("a", id)))

			require.True(t, apierrors.IsInvalid(err), "expected an Invalid error, got %v", err)
			require.ErrorContains(t, err, "UUID v4")
		})
	}

	t.Run("reports every bad cell, not only the first", func(t *testing.T) {
		err := validateNotebookCellIDs(notebookWithCells(layoutCell("a", "nope"), layoutCell("b", testCellID(1)), layoutCell("c", testCellID(1))))

		require.ErrorContains(t, err, "cells[0]")
		require.ErrorContains(t, err, "cells[2]")
	})
}
