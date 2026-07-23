package dashboard

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/admission"

	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
)

// newNotebook builds a notebook with a valid notebook layout; callers override
// the layout kind to exercise rejection paths.
func newNotebook(name string) *dashv2beta1.Notebook {
	nb := &dashv2beta1.Notebook{}
	nb.SetName(name)
	nb.Spec.Title = "My notebook"
	nb.Spec.Layout = *dashv2beta1.NewNotebookNotebookLayoutKind()
	return nb
}

func notebookAttributes(op admission.Operation, nb *dashv2beta1.Notebook, opts runtime.Object) admission.Attributes {
	return admission.NewAttributesRecord(
		nb,
		nil,
		dashv2beta1.NotebookResourceInfo.GroupVersionKind(),
		"stacks-1",
		nb.GetName(),
		dashv2beta1.NotebookResourceInfo.GroupVersionResource(),
		"",
		op,
		opts,
		false,
		nil,
	)
}

func TestValidateNotebook(t *testing.T) {
	t.Run("valid notebook layout is accepted", func(t *testing.T) {
		require.NoError(t, validateNotebook(newNotebook("nb")))
	})

	t.Run("dashboard layout kind is rejected", func(t *testing.T) {
		nb := newNotebook("nb")
		nb.Spec.Layout.Kind = "GridLayout"
		require.ErrorContains(t, validateNotebook(nb), "layout kind")
	})

	t.Run("empty layout kind is rejected", func(t *testing.T) {
		nb := newNotebook("nb")
		nb.Spec.Layout.Kind = ""
		require.ErrorContains(t, validateNotebook(nb), "layout kind")
	})

	t.Run("nil notebook is rejected", func(t *testing.T) {
		require.Error(t, validateNotebook(nil))
	})
}

func TestDashboardsAPIBuilderValidateNotebook(t *testing.T) {
	builder := &DashboardsAPIBuilder{}
	ctx := context.Background()

	t.Run("rejects a non-notebook layout on create and update", func(t *testing.T) {
		cases := []struct {
			name string
			op   admission.Operation
			opts runtime.Object
		}{
			{name: "create", op: admission.Create, opts: &metav1.CreateOptions{}},
			{name: "update", op: admission.Update, opts: &metav1.UpdateOptions{}},
		}
		for _, tc := range cases {
			t.Run(tc.name, func(t *testing.T) {
				nb := newNotebook("bad")
				nb.Spec.Layout.Kind = "GridLayout"
				err := builder.Validate(ctx, notebookAttributes(tc.op, nb, tc.opts), nil)
				require.ErrorContains(t, err, "layout kind")
			})
		}
	})

	t.Run("accepts a valid notebook layout on create and update", func(t *testing.T) {
		cases := []struct {
			name string
			op   admission.Operation
			opts runtime.Object
		}{
			{name: "create", op: admission.Create, opts: &metav1.CreateOptions{}},
			{name: "update", op: admission.Update, opts: &metav1.UpdateOptions{}},
		}
		for _, tc := range cases {
			t.Run(tc.name, func(t *testing.T) {
				nb := newNotebook("good")
				err := builder.Validate(ctx, notebookAttributes(tc.op, nb, tc.opts), nil)
				require.NoError(t, err)
			})
		}
	})

	t.Run("delete is admitted without layout validation", func(t *testing.T) {
		nb := newNotebook("bad")
		nb.Spec.Layout.Kind = "GridLayout"
		err := builder.Validate(ctx, notebookAttributes(admission.Delete, nb, &metav1.DeleteOptions{}), nil)
		require.NoError(t, err)
	})
}
