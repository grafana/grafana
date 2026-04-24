package dashboard

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apiserver/pkg/admission"
	k8srequest "k8s.io/apiserver/pkg/endpoints/request"

	dashv2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/apiserver/client"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestValidateVariable(t *testing.T) {
	t.Run("valid custom variable", func(t *testing.T) {
		v := newCustomVariable("region", "region")
		require.NoError(t, validateVariable(v))
	})

	t.Run("metadata and spec names can differ", func(t *testing.T) {
		v := newCustomVariable("region", "env")
		require.NoError(t, validateVariable(v))
	})

	t.Run("empty variable name is rejected", func(t *testing.T) {
		v := newCustomVariable("", "")
		require.ErrorContains(t, validateVariable(v), "variable name must not be empty")
	})

	t.Run("reserved prefix is rejected", func(t *testing.T) {
		v := newCustomVariable("__region", "__region")
		require.ErrorContains(t, validateVariable(v), "must not start with '__'")
	})

	t.Run("name with spaces is rejected", func(t *testing.T) {
		v := newCustomVariable("my variable", "my-variable")
		require.ErrorContains(t, validateVariable(v), "must contain only letters, digits, and underscores")
	})

	t.Run("name with dot is rejected", func(t *testing.T) {
		v := newCustomVariable("my.var", "my-var")
		require.ErrorContains(t, validateVariable(v), "must contain only letters, digits, and underscores")
	})

	t.Run("multiple variable kinds are rejected", func(t *testing.T) {
		v := newCustomVariable("region", "region")
		queryVariable := dashv2.NewDashboardQueryVariableKind()
		queryVariable.Spec.Name = "region"
		v.Spec.QueryVariableKind = queryVariable

		require.ErrorContains(t, validateVariable(v), "exactly one variable kind")
	})
}

func TestDashboardsAPIBuilderValidateVariable(t *testing.T) {
	builder := &DashboardsAPIBuilder{}
	v := newCustomVariable("region", "region")
	ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{OrgRole: identity.RoleEditor})

	err := builder.Validate(ctx, admission.NewAttributesRecord(
		v,
		nil,
		dashv2.VariableResourceInfo.GroupVersionKind(),
		"stacks-1",
		v.GetName(),
		dashv2.VariableResourceInfo.GroupVersionResource(),
		"",
		admission.Create,
		&metav1.CreateOptions{},
		false,
		nil,
	), nil)

	require.NoError(t, err)
}

func TestDashboardsAPIBuilderValidateVariableCreateRequiresFolderAccess(t *testing.T) {
	folderUID := "folder-a"
	v := newCustomVariable("region", "region")
	v.SetAnnotations(map[string]string{utils.AnnoKeyFolder: folderUID})

	ctx := k8srequest.WithNamespace(context.Background(), "stacks-1")
	ctx = identity.WithRequester(ctx, &identity.StaticRequester{
		OrgRole: identity.RoleEditor,
		OrgID:   1,
	})

	folderHandler := &variableFolderAccessHandler{
		forbiddenAccessSubresource: true,
	}

	builder := &DashboardsAPIBuilder{
		folderClientProvider: &staticHandlerProvider{handler: folderHandler},
	}

	err := builder.Validate(ctx, admission.NewAttributesRecord(
		v,
		nil,
		dashv2.VariableResourceInfo.GroupVersionKind(),
		"stacks-1",
		v.GetName(),
		dashv2.VariableResourceInfo.GroupVersionResource(),
		"",
		admission.Create,
		&metav1.CreateOptions{},
		false,
		nil,
	), nil)

	require.Error(t, err)
	require.True(t, apierrors.IsForbidden(err))
	require.True(t, folderHandler.accessSubresourceChecked)
}

func TestDashboardsAPIBuilderValidateVariableUpdateScopeChangeRequiresFolderAccess(t *testing.T) {
	oldVariable := newCustomVariable("region", "region")
	newVariable := newCustomVariable("region", "region")
	newVariable.SetAnnotations(map[string]string{utils.AnnoKeyFolder: "folder-a"})

	ctx := k8srequest.WithNamespace(context.Background(), "stacks-1")
	ctx = identity.WithRequester(ctx, &identity.StaticRequester{
		OrgRole: identity.RoleEditor,
		OrgID:   1,
	})

	folderHandler := &variableFolderAccessHandler{
		forbiddenAccessSubresource: true,
	}

	builder := &DashboardsAPIBuilder{
		folderClientProvider: &staticHandlerProvider{handler: folderHandler},
	}

	err := builder.Validate(ctx, buildVariableAttributesForOp(admission.Update, newVariable, oldVariable), nil)

	require.Error(t, err)
	require.True(t, apierrors.IsForbidden(err))
	require.True(t, folderHandler.accessSubresourceChecked)
}

func TestDashboardsAPIBuilderValidateVariableUpdateScopeChangeToGlobalSkipsFolderAccessCheck(t *testing.T) {
	oldVariable := newCustomVariable("region", "region")
	oldVariable.SetAnnotations(map[string]string{utils.AnnoKeyFolder: "folder-a"})
	newVariable := newCustomVariable("region", "region")

	ctx := k8srequest.WithNamespace(context.Background(), "stacks-1")
	ctx = identity.WithRequester(ctx, &identity.StaticRequester{
		OrgRole: identity.RoleEditor,
		OrgID:   1,
	})

	folderHandler := &variableFolderAccessHandler{
		forbiddenAccessSubresource: true,
	}

	builder := &DashboardsAPIBuilder{
		folderClientProvider: &staticHandlerProvider{handler: folderHandler},
	}

	err := builder.Validate(ctx, buildVariableAttributesForOp(admission.Update, newVariable, oldVariable), nil)

	require.NoError(t, err)
	require.False(t, folderHandler.accessSubresourceChecked)
}

func TestVariableMutationPermissionsByRole(t *testing.T) {
	builder := &DashboardsAPIBuilder{}
	oldVariable := newCustomVariable("region", "region")
	newVariable := newCustomVariable("region", "region")

	tests := []struct {
		name     string
		role     identity.RoleType
		op       admission.Operation
		expected bool
	}{
		{name: "admin can create", role: identity.RoleAdmin, op: admission.Create, expected: true},
		{name: "editor can create", role: identity.RoleEditor, op: admission.Create, expected: true},
		{name: "viewer cannot create", role: identity.RoleViewer, op: admission.Create, expected: false},
		{name: "none cannot create", role: identity.RoleNone, op: admission.Create, expected: false},
		{name: "admin can update", role: identity.RoleAdmin, op: admission.Update, expected: true},
		{name: "editor can update", role: identity.RoleEditor, op: admission.Update, expected: true},
		{name: "viewer cannot update", role: identity.RoleViewer, op: admission.Update, expected: false},
		{name: "none cannot update", role: identity.RoleNone, op: admission.Update, expected: false},
		{name: "admin can delete", role: identity.RoleAdmin, op: admission.Delete, expected: true},
		{name: "editor can delete", role: identity.RoleEditor, op: admission.Delete, expected: true},
		{name: "viewer cannot delete", role: identity.RoleViewer, op: admission.Delete, expected: false},
		{name: "none cannot delete", role: identity.RoleNone, op: admission.Delete, expected: false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{OrgRole: tc.role})
			attrs := buildVariableAttributesForOp(tc.op, newVariable, oldVariable)

			err := builder.Validate(ctx, attrs, nil)
			if tc.expected {
				require.NoError(t, err)
				return
			}

			require.Error(t, err)
			require.Contains(t, err.Error(), "variable mutation requires editor or admin role")
		})
	}
}

func newCustomVariable(variableName, metadataName string) *dashv2.Variable {
	customVariable := dashv2.NewDashboardCustomVariableKind()
	customVariable.Spec.Name = variableName

	spec := dashv2.NewVariableSpec()
	spec.CustomVariableKind = customVariable

	return &dashv2.Variable{
		ObjectMeta: metav1.ObjectMeta{
			Name: metadataName,
		},
		Spec: *spec,
	}
}

func TestVariableNameUniquenessHelpers(t *testing.T) {
	t.Run("list options include folder label only for folder scope", func(t *testing.T) {
		globalScope := buildVariableNameListOptions("region", "")
		require.Equal(t, "spec.spec.name=region", globalScope.FieldSelector)
		require.Empty(t, globalScope.LabelSelector)

		folderScope := buildVariableNameListOptions("region", "folder-a")
		require.Equal(t, "spec.spec.name=region", folderScope.FieldSelector)
		require.Equal(t, variableFolderLabelKey+"=folder-a", folderScope.LabelSelector)
	})

	t.Run("global scope ignores folder-scoped matches", func(t *testing.T) {
		list := &unstructured.UnstructuredList{
			Items: []unstructured.Unstructured{
				{
					Object: map[string]any{
						"metadata": map[string]any{
							"name": "folder-only",
							"labels": map[string]any{
								variableFolderLabelKey: "folder-a",
							},
						},
					},
				},
			},
		}

		require.Empty(t, findVariableNameConflict(list, "", ""))
	})

	t.Run("folder scope checks only same folder and excludes current object", func(t *testing.T) {
		list := &unstructured.UnstructuredList{
			Items: []unstructured.Unstructured{
				{
					Object: map[string]any{
						"metadata": map[string]any{
							"name": "same-folder-conflict",
							"labels": map[string]any{
								variableFolderLabelKey: "folder-a",
							},
						},
					},
				},
				{
					Object: map[string]any{
						"metadata": map[string]any{
							"name": "different-folder",
							"labels": map[string]any{
								variableFolderLabelKey: "folder-b",
							},
						},
					},
				},
			},
		}

		require.Equal(t, "same-folder-conflict", findVariableNameConflict(list, "folder-a", ""))
		require.Empty(t, findVariableNameConflict(list, "folder-a", "same-folder-conflict"))
	})
}

func TestPickVariableWinner(t *testing.T) {
	mkItem := func(name, uid string, created time.Time) unstructured.Unstructured {
		return unstructured.Unstructured{
			Object: map[string]any{
				"metadata": map[string]any{
					"name":              name,
					"uid":               uid,
					"creationTimestamp": metav1.NewTime(created).Format(time.RFC3339),
				},
			},
		}
	}

	t.Run("single item is its own winner", func(t *testing.T) {
		base := time.Date(2026, 1, 1, 10, 0, 0, 0, time.UTC)
		items := []unstructured.Unstructured{mkItem("only", "uid-1", base)}
		winner := pickVariableWinner(items)
		require.Equal(t, "only", winner.GetName())
	})

	t.Run("earliest creationTimestamp wins", func(t *testing.T) {
		base := time.Date(2026, 1, 1, 10, 0, 0, 0, time.UTC)
		items := []unstructured.Unstructured{
			mkItem("second", "uid-b", base.Add(5*time.Second)),
			mkItem("first", "uid-a", base),
			mkItem("third", "uid-c", base.Add(10*time.Second)),
		}
		winner := pickVariableWinner(items)
		require.Equal(t, "first", winner.GetName())
	})

	t.Run("ties broken by lowest UID lexicographically", func(t *testing.T) {
		base := time.Date(2026, 1, 1, 10, 0, 0, 0, time.UTC)
		items := []unstructured.Unstructured{
			mkItem("zoo", "uid-zzz", base),
			mkItem("alpha", "uid-aaa", base),
			mkItem("mid", "uid-mmm", base),
		}
		winner := pickVariableWinner(items)
		require.Equal(t, "uid-aaa", string(winner.GetUID()))
	})

	t.Run("timestamp beats UID when not tied", func(t *testing.T) {
		base := time.Date(2026, 1, 1, 10, 0, 0, 0, time.UTC)
		items := []unstructured.Unstructured{
			mkItem("late-low-uid", "uid-aaa", base.Add(time.Second)),
			mkItem("early-high-uid", "uid-zzz", base),
		}
		winner := pickVariableWinner(items)
		require.Equal(t, "early-high-uid", winner.GetName())
	})
}

func TestFilterVariablesInScope(t *testing.T) {
	list := &unstructured.UnstructuredList{
		Items: []unstructured.Unstructured{
			makeVariableListItem("global-a", "uid-global-a", "", time.Time{}),
			makeVariableListItem("folder-a-1", "uid-f-a-1", "folder-a", time.Time{}),
			makeVariableListItem("folder-b-1", "uid-f-b-1", "folder-b", time.Time{}),
		},
	}

	t.Run("global scope keeps only items without a folder label", func(t *testing.T) {
		items := filterVariablesInScope(list, "")
		require.Len(t, items, 1)
		require.Equal(t, "global-a", items[0].GetName())
	})

	t.Run("folder scope keeps only items in the same folder", func(t *testing.T) {
		items := filterVariablesInScope(list, "folder-a")
		require.Len(t, items, 1)
		require.Equal(t, "folder-a-1", items[0].GetName())
	})

	t.Run("nil list returns nil", func(t *testing.T) {
		require.Nil(t, filterVariablesInScope(nil, ""))
	})
}

func TestResolveVariableNameConflictAfterCreate(t *testing.T) {
	ctx := context.Background()
	createdTime := time.Date(2026, 1, 1, 10, 0, 0, 0, time.UTC)

	t.Run("returns false when no duplicate exists", func(t *testing.T) {
		created := newCreatedVariable("region", "region-123", "uid-created", "42", "", createdTime)
		handler := &client.MockK8sHandler{}
		handler.On("List", mock.Anything, int64(1), mock.MatchedBy(matchListOptions("region", "", "42"))).
			Return(&unstructured.UnstructuredList{
				Items: []unstructured.Unstructured{
					makeVariableListItem("region-123", "uid-created", "", createdTime),
				},
			}, nil).Once()

		lost, err := resolveVariableNameConflictAfterCreate(ctx, &staticHandlerProvider{handler: handler}, created)
		require.NoError(t, err)
		require.False(t, lost)
		handler.AssertExpectations(t)
	})

	t.Run("returns false when we are the tie-break winner", func(t *testing.T) {
		created := newCreatedVariable("region", "region-created", "uid-aaa", "42", "", createdTime)
		handler := &client.MockK8sHandler{}
		handler.On("List", mock.Anything, int64(1), mock.Anything).
			Return(&unstructured.UnstructuredList{
				Items: []unstructured.Unstructured{
					makeVariableListItem("region-created", "uid-aaa", "", createdTime),
					makeVariableListItem("region-other", "uid-zzz", "", createdTime.Add(time.Second)),
				},
			}, nil).Once()

		lost, err := resolveVariableNameConflictAfterCreate(ctx, &staticHandlerProvider{handler: handler}, created)
		require.NoError(t, err)
		require.False(t, lost)
	})

	t.Run("returns true when we lost to an earlier creationTimestamp", func(t *testing.T) {
		created := newCreatedVariable("region", "region-created", "uid-later", "42", "", createdTime.Add(time.Second))
		handler := &client.MockK8sHandler{}
		handler.On("List", mock.Anything, int64(1), mock.Anything).
			Return(&unstructured.UnstructuredList{
				Items: []unstructured.Unstructured{
					makeVariableListItem("region-created", "uid-later", "", createdTime.Add(time.Second)),
					makeVariableListItem("region-winner", "uid-winner", "", createdTime),
				},
			}, nil).Once()

		lost, err := resolveVariableNameConflictAfterCreate(ctx, &staticHandlerProvider{handler: handler}, created)
		require.NoError(t, err)
		require.True(t, lost)
	})

	t.Run("folder-scoped duplicates ignore global-scope entries", func(t *testing.T) {
		created := newCreatedVariable("region", "region-f", "uid-f", "42", "folder-a", createdTime)
		handler := &client.MockK8sHandler{}
		handler.On("List", mock.Anything, int64(1), mock.Anything).
			Return(&unstructured.UnstructuredList{
				Items: []unstructured.Unstructured{
					makeVariableListItem("region-f", "uid-f", "folder-a", createdTime),
					makeVariableListItem("region-global", "uid-g", "", createdTime.Add(-time.Hour)),
					makeVariableListItem("region-other-folder", "uid-o", "folder-b", createdTime.Add(-time.Hour)),
				},
			}, nil).Once()

		lost, err := resolveVariableNameConflictAfterCreate(ctx, &staticHandlerProvider{handler: handler}, created)
		require.NoError(t, err)
		require.False(t, lost, "only the folder-a entry is in scope, so we are the sole survivor")
	})

	t.Run("list error is surfaced", func(t *testing.T) {
		created := newCreatedVariable("region", "region-x", "uid-x", "42", "", createdTime)
		handler := &client.MockK8sHandler{}
		handler.On("List", mock.Anything, int64(1), mock.Anything).
			Return(nil, errors.New("kaboom")).Once()

		_, err := resolveVariableNameConflictAfterCreate(ctx, &staticHandlerProvider{handler: handler}, created)
		require.Error(t, err)
		require.Contains(t, err.Error(), "post-create uniqueness check")
	})

	t.Run("nil provider returns false without error", func(t *testing.T) {
		created := newCreatedVariable("region", "region-x", "uid-x", "42", "", createdTime)
		lost, err := resolveVariableNameConflictAfterCreate(ctx, nil, created)
		require.NoError(t, err)
		require.False(t, lost)
	})
}

// newCreatedVariable builds a *dashv2.Variable resembling the object returned
// by registry.Store.Create: metadata is fully populated including namespace,
// UID, resourceVersion, and (optionally) folder annotation + label.
func newCreatedVariable(specName, metadataName, uid, resourceVersion, folderUID string, created time.Time) *dashv2.Variable {
	v := newCustomVariable(specName, metadataName)
	v.SetNamespace("stacks-1")
	v.SetUID(types.UID(uid))
	v.SetResourceVersion(resourceVersion)
	v.SetCreationTimestamp(metav1.NewTime(created))
	if folderUID != "" {
		v.SetAnnotations(map[string]string{utils.AnnoKeyFolder: folderUID})
		v.SetLabels(map[string]string{variableFolderLabelKey: folderUID})
	}
	return v
}

// makeVariableListItem builds an unstructured list entry shaped like the one
// a List call would return for a Variable. Only the fields consulted by the
// resolver are populated.
func makeVariableListItem(name, uid, folderUID string, created time.Time) unstructured.Unstructured {
	meta := map[string]any{
		"name": name,
		"uid":  uid,
	}
	if !created.IsZero() {
		meta["creationTimestamp"] = metav1.NewTime(created).Format(time.RFC3339)
	}
	if folderUID != "" {
		meta["labels"] = map[string]any{
			variableFolderLabelKey: folderUID,
		}
	}
	return unstructured.Unstructured{Object: map[string]any{"metadata": meta}}
}

// matchListOptions asserts the field selector and (if set) resourceVersion
// floor passed to the post-create list. It also permits any folder label
// selector so tests can share it across scope variants.
func matchListOptions(specName, folderUID, resourceVersion string) func(metav1.ListOptions) bool {
	return func(opts metav1.ListOptions) bool {
		if opts.FieldSelector != "spec.spec.name="+specName {
			return false
		}
		if folderUID != "" && opts.LabelSelector != variableFolderLabelKey+"="+folderUID {
			return false
		}
		if resourceVersion != "" {
			if opts.ResourceVersion != resourceVersion {
				return false
			}
			if opts.ResourceVersionMatch != metav1.ResourceVersionMatchNotOlderThan {
				return false
			}
		}
		return true
	}
}

func buildVariableAttributesForOp(op admission.Operation, newVariable, oldVariable *dashv2.Variable) admission.Attributes {
	switch op {
	case admission.Create:
		return admission.NewAttributesRecord(
			newVariable,
			nil,
			dashv2.VariableResourceInfo.GroupVersionKind(),
			"stacks-1",
			newVariable.GetName(),
			dashv2.VariableResourceInfo.GroupVersionResource(),
			"",
			admission.Create,
			&metav1.CreateOptions{},
			false,
			nil,
		)
	case admission.Update:
		return admission.NewAttributesRecord(
			newVariable,
			oldVariable,
			dashv2.VariableResourceInfo.GroupVersionKind(),
			"stacks-1",
			newVariable.GetName(),
			dashv2.VariableResourceInfo.GroupVersionResource(),
			"",
			admission.Update,
			&metav1.UpdateOptions{},
			false,
			nil,
		)
	default:
		return admission.NewAttributesRecord(
			nil,
			oldVariable,
			dashv2.VariableResourceInfo.GroupVersionKind(),
			"stacks-1",
			oldVariable.GetName(),
			dashv2.VariableResourceInfo.GroupVersionResource(),
			"",
			admission.Delete,
			&metav1.DeleteOptions{},
			false,
			nil,
		)
	}
}

type staticHandlerProvider struct {
	handler client.K8sHandler
}

func (p *staticHandlerProvider) GetOrCreateHandler(namespace string) client.K8sHandler {
	return p.handler
}

type variableFolderAccessHandler struct {
	accessSubresourceChecked   bool
	forbiddenAccessSubresource bool
}

func (h *variableFolderAccessHandler) Get(_ context.Context, name string, _ int64, _ metav1.GetOptions, subresource ...string) (*unstructured.Unstructured, error) {
	if len(subresource) > 0 && subresource[0] == "access" {
		h.accessSubresourceChecked = true
		if h.forbiddenAccessSubresource {
			return nil, apierrors.NewForbidden(schema.GroupResource{Group: "folder.grafana.app", Resource: "folders"}, name, nil)
		}

		return &unstructured.Unstructured{
			Object: map[string]any{
				"spec": map[string]any{
					"canEdit": true,
				},
			},
		}, nil
	}

	return &unstructured.Unstructured{
		Object: map[string]any{
			"metadata": map[string]any{
				"name": name,
			},
		},
	}, nil
}

func (h *variableFolderAccessHandler) GetNamespace(_ int64) string { return "stacks-1" }
func (h *variableFolderAccessHandler) Create(_ context.Context, _ *unstructured.Unstructured, _ int64, _ metav1.CreateOptions) (*unstructured.Unstructured, error) {
	return nil, nil
}
func (h *variableFolderAccessHandler) Update(_ context.Context, _ *unstructured.Unstructured, _ int64, _ metav1.UpdateOptions) (*unstructured.Unstructured, error) {
	return nil, nil
}
func (h *variableFolderAccessHandler) Delete(_ context.Context, _ string, _ int64, _ metav1.DeleteOptions) error {
	return nil
}
func (h *variableFolderAccessHandler) DeleteCollection(_ context.Context, _ int64, _ metav1.ListOptions) error {
	return nil
}
func (h *variableFolderAccessHandler) List(_ context.Context, _ int64, _ metav1.ListOptions) (*unstructured.UnstructuredList, error) {
	return nil, nil
}
func (h *variableFolderAccessHandler) Search(_ context.Context, _ int64, _ *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
	return nil, nil
}
func (h *variableFolderAccessHandler) GetStats(_ context.Context, _ int64) (*resourcepb.ResourceStatsResponse, error) {
	return nil, nil
}
func (h *variableFolderAccessHandler) GetUsersFromMeta(_ context.Context, _ []string) (map[string]*user.User, error) {
	return nil, nil
}
