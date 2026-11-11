package dashboard

import (
	"context"
	"testing"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
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
	return notebookAttributesWithOld(op, nb, nil, opts)
}

// notebookAttributesWithOld is notebookAttributes for an update, which carries the stored object.
func notebookAttributesWithOld(op admission.Operation, nb *dashv2beta1.Notebook, old runtime.Object, opts runtime.Object) admission.Attributes {
	return admission.NewAttributesRecord(
		nb,
		old,
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

	t.Run("rejects two cells that share an id on create and update", func(t *testing.T) {
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
				nb := newNotebook("dup")
				nb.Spec.Layout.Spec.Cells = []dashv2beta1.NotebookNotebookLayoutItemKind{
					layoutCell("a", testCellID(1)),
					layoutCell("b", testCellID(1)),
				}
				err := builder.Validate(ctx, notebookAttributes(tc.op, nb, tc.opts), nil)
				require.True(t, apierrors.IsInvalid(err), "expected an Invalid error, got %v", err)
				require.ErrorContains(t, err, "spec.layout.spec.cells[1].spec.id")
			})
		}
	})
}

// The format the UI uses for the same default, so the two cannot drift apart unnoticed.
const defaultTitlePattern = `^Notebook \d{4}-\d{2}-\d{2} \d{2}:\d{2}$`

func TestMutateNotebook(t *testing.T) {
	t.Run("a notebook created without a title is named after the time it was created", func(t *testing.T) {
		nb := newNotebook("nb")
		nb.Spec.Title = ""

		require.NoError(t, mutateNotebook(notebookAttributes(admission.Create, nb, &metav1.CreateOptions{})))

		require.Regexp(t, defaultTitlePattern, nb.Spec.Title)
	})

	// A title of spaces is as blank a row in the list as no title at all.
	t.Run("a title of only whitespace counts as no title", func(t *testing.T) {
		nb := newNotebook("nb")
		nb.Spec.Title = "   "

		require.NoError(t, mutateNotebook(notebookAttributes(admission.Create, nb, &metav1.CreateOptions{})))

		require.Regexp(t, defaultTitlePattern, nb.Spec.Title)
	})

	t.Run("a title the client supplied is left exactly as it is", func(t *testing.T) {
		nb := newNotebook("nb")
		nb.Spec.Title = "  Incident review  "

		require.NoError(t, mutateNotebook(notebookAttributes(admission.Create, nb, &metav1.CreateOptions{})))

		require.Equal(t, "  Incident review  ", nb.Spec.Title)
	})

	// Naming it here would report the time of the edit as the time of creation.
	t.Run("a title cleared on update is left cleared", func(t *testing.T) {
		nb := newNotebook("nb")
		nb.Spec.Title = ""

		require.NoError(t, mutateNotebook(notebookAttributes(admission.Update, nb, &metav1.UpdateOptions{})))

		require.Empty(t, nb.Spec.Title)
	})

	for _, tc := range []struct {
		name string
		op   admission.Operation
		opts runtime.Object
	}{
		{"create", admission.Create, &metav1.CreateOptions{}},
		{"update", admission.Update, &metav1.UpdateOptions{}},
	} {
		t.Run("a hidden time picker is turned off on "+tc.name, func(t *testing.T) {
			nb := newNotebook("nb")
			nb.Spec.TimeSettings.HideTimepicker = true
			nb.Spec.TimeSettings.From = "now-1h"

			require.NoError(t, mutateNotebook(notebookAttributes(tc.op, nb, tc.opts)))

			require.False(t, nb.Spec.TimeSettings.HideTimepicker)
			require.Equal(t, "now-1h", nb.Spec.TimeSettings.From)
		})
	}
}

func TestDashboardsAPIBuilderMutateNotebook(t *testing.T) {
	builder := &DashboardsAPIBuilder{}
	ctx := context.Background()

	t.Run("routes a notebook create to the notebook mutation", func(t *testing.T) {
		nb := newNotebook("nb")
		nb.Spec.Title = ""

		require.NoError(t, builder.Mutate(ctx, notebookAttributes(admission.Create, nb, &metav1.CreateOptions{}), nil))

		require.Regexp(t, defaultTitlePattern, nb.Spec.Title)
	})

	// Mutate returns early for anything that is not a create or an update, so the object it was
	// handed is never touched.
	t.Run("leaves a delete alone", func(t *testing.T) {
		nb := newNotebook("nb")
		nb.Spec.Title = ""
		nb.Spec.Layout.Spec.Cells = []dashv2beta1.NotebookNotebookLayoutItemKind{layoutCell("a", "")}

		require.NoError(t, builder.Mutate(ctx, notebookAttributes(admission.Delete, nb, &metav1.DeleteOptions{}), nil))

		require.Empty(t, nb.Spec.Title)
		require.Nil(t, nb.Spec.Layout.Spec.Cells[0].Spec.Id)
	})

	t.Run("gives every cell of a created notebook an id", func(t *testing.T) {
		nb := newNotebook("nb")
		nb.Spec.Layout.Spec.Cells = []dashv2beta1.NotebookNotebookLayoutItemKind{layoutCell("a", ""), layoutCell("b", "")}

		require.NoError(t, builder.Mutate(ctx, notebookAttributes(admission.Create, nb, &metav1.CreateOptions{}), nil))

		require.Regexp(t, notebookCellIDPattern, notebookCellID(nb.Spec.Layout.Spec.Cells[0]))
		require.Regexp(t, notebookCellIDPattern, notebookCellID(nb.Spec.Layout.Spec.Cells[1]))
	})

	// What the editor does: it saves the whole spec, and a client that has not learned about ids sends
	// none back.
	t.Run("an update without ids keeps the ids of the stored notebook", func(t *testing.T) {
		stored := newNotebook("nb")
		stored.Spec.Layout.Spec.Cells = []dashv2beta1.NotebookNotebookLayoutItemKind{
			layoutCell("a", testCellID(1)),
			layoutCell("b", testCellID(2)),
		}
		incoming := newNotebook("nb")
		incoming.Spec.Layout.Spec.Cells = []dashv2beta1.NotebookNotebookLayoutItemKind{layoutCell("b", ""), layoutCell("a", "")}

		attrs := notebookAttributesWithOld(admission.Update, incoming, stored, &metav1.UpdateOptions{})
		require.NoError(t, builder.Mutate(ctx, attrs, nil))

		require.Equal(t, testCellID(2), notebookCellID(incoming.Spec.Layout.Spec.Cells[0]))
		require.Equal(t, testCellID(1), notebookCellID(incoming.Spec.Layout.Spec.Cells[1]))
	})

	t.Run("an update whose stored object is not a notebook is an error", func(t *testing.T) {
		nb := newNotebook("nb")

		attrs := notebookAttributesWithOld(admission.Update, nb, &dashv0.Dashboard{}, &metav1.UpdateOptions{})

		require.ErrorContains(t, builder.Mutate(ctx, attrs, nil), "expected notebook")
	})
}

func setNotebooksToggle(t *testing.T, enabled bool) {
	t.Helper()
	variant := "disabled"
	if enabled {
		variant = "enabled"
	}
	require.NoError(t, openfeature.SetProviderAndWait(memprovider.NewInMemoryProvider(map[string]memprovider.InMemoryFlag{
		featuremgmt.FlagDashboardNotebooks: {
			Key:            featuremgmt.FlagDashboardNotebooks,
			DefaultVariant: variant,
			Variants: map[string]any{
				"enabled":  true,
				"disabled": false,
			},
		},
	})))
	t.Cleanup(func() {
		_ = openfeature.SetProviderAndWait(openfeature.NoopProvider{})
	})
}

func authzAttributes(resource, verb string) authorizer.Attributes {
	return authorizer.AttributesRecord{
		ResourceRequest: true,
		APIGroup:        dashv2beta1.GROUP,
		APIVersion:      dashv2beta1.VERSION,
		Resource:        resource,
		Verb:            verb,
		Namespace:       "stacks-1",
	}
}

// TestDashboardsAPIBuilderNotebookAuthorizer verifies that the notebook feature
// is gated per request in the authorizer: notebook storage is always registered,
// so enablement is enforced here rather than at route-registration time.
func TestDashboardsAPIBuilderNotebookAuthorizer(t *testing.T) {
	ctx := context.Background()
	authz := (&DashboardsAPIBuilder{}).GetAuthorizer()

	t.Run("denies notebook requests for every verb when disabled", func(t *testing.T) {
		setNotebooksToggle(t, false)
		for _, verb := range []string{"get", "list", "watch", "create", "update", "delete", "deletecollection"} {
			t.Run(verb, func(t *testing.T) {
				decision, reason, err := authz.Authorize(ctx, authzAttributes(dashv2beta1.NotebookResourceInfo.GetName(), verb))
				require.NoError(t, err)
				require.Equal(t, authorizer.DecisionDeny, decision)
				require.Equal(t, "notebooks feature is not enabled", reason)
			})
		}
	})

	t.Run("falls through to the service authorizer for notebooks when enabled", func(t *testing.T) {
		setNotebooksToggle(t, true)
		// The service authorizer rejects a request with no identity in context and
		// surfaces a non-nil error; the notebook gate never returns an error, so a
		// "no identity" error proves the request fell through rather than being
		// short-circuited by the feature gate.
		_, _, err := authz.Authorize(ctx, authzAttributes(dashv2beta1.NotebookResourceInfo.GetName(), "get"))
		require.ErrorContains(t, err, "no identity found")
	})

	t.Run("does not gate other resources on the notebook flag", func(t *testing.T) {
		setNotebooksToggle(t, false)
		// Dashboards must reach the service authorizer regardless of the notebook
		// flag being off.
		_, _, err := authz.Authorize(ctx, authzAttributes(dashv0.DashboardResourceInfo.GetName(), "get"))
		require.ErrorContains(t, err, "no identity found")
	})
}
