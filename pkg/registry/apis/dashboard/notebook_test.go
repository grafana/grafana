package dashboard

import (
	"context"
	"testing"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/stretchr/testify/require"
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
