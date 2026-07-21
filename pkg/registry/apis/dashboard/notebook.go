package dashboard

import (
	"fmt"

	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
)

// notebookLayoutKind is the only layout kind a Notebook may use. The generated
// layout type's Kind field is a free-form string, so a notebook could otherwise
// carry a dashboard layout kind (e.g. GridLayout); this is rejected at admission.
const notebookLayoutKind = "NotebookLayout"

func validateNotebook(notebook *dashv2beta1.Notebook) error {
	if notebook == nil {
		return fmt.Errorf("notebook payload is required")
	}

	if notebook.Spec.Layout.Kind != notebookLayoutKind {
		return fmt.Errorf("notebook layout kind must be %q, got %q", notebookLayoutKind, notebook.Spec.Layout.Kind)
	}

	return nil
}
