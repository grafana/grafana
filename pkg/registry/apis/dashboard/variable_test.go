package dashboard

import (
	"context"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	types "k8s.io/apimachinery/pkg/types"
	"k8s.io/apiserver/pkg/admission"
	k8srequest "k8s.io/apiserver/pkg/endpoints/request"

	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
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
		queryVariable := dashv2beta1.NewDashboardQueryVariableKind()
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
		dashv2beta1.VariableResourceInfo.GroupVersionKind(),
		"stacks-1",
		v.GetName(),
		dashv2beta1.VariableResourceInfo.GroupVersionResource(),
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
	v := newCustomVariable("region", "")
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
		dashv2beta1.VariableResourceInfo.GroupVersionKind(),
		"stacks-1",
		v.GetName(),
		dashv2beta1.VariableResourceInfo.GroupVersionResource(),
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

func TestDashboardsAPIBuilderValidateVariableCreateMissingFolderHandlerReturnsError(t *testing.T) {
	folderUID := "folder-a"
	v := newCustomVariable("region", "")
	v.SetAnnotations(map[string]string{utils.AnnoKeyFolder: folderUID})

	ctx := k8srequest.WithNamespace(context.Background(), "stacks-1")
	ctx = identity.WithRequester(ctx, &identity.StaticRequester{
		OrgRole: identity.RoleEditor,
		OrgID:   1,
	})

	builder := &DashboardsAPIBuilder{
		folderClientProvider: &staticHandlerProvider{},
	}

	err := builder.Validate(ctx, admission.NewAttributesRecord(
		v,
		nil,
		dashv2beta1.VariableResourceInfo.GroupVersionKind(),
		"stacks-1",
		v.GetName(),
		dashv2beta1.VariableResourceInfo.GroupVersionResource(),
		"",
		admission.Create,
		&metav1.CreateOptions{},
		false,
		nil,
	), nil)

	require.Error(t, err)
	require.Contains(t, err.Error(), "folder client handler is not configured")
}

func TestDashboardsAPIBuilderValidateVariableCreateMetadataNameContract(t *testing.T) {
	ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{OrgRole: identity.RoleEditor, OrgID: 1})
	builder := &DashboardsAPIBuilder{}

	t.Run("name may be omitted and derived during mutation", func(t *testing.T) {
		v := newCustomVariable("status", "")

		err := builder.Validate(ctx, buildVariableAttributesForOp(admission.Create, v, nil), nil)
		require.NoError(t, err)
	})

	t.Run("explicit name must match derived value", func(t *testing.T) {
		v := newCustomVariable("status", "status5")
		v.SetAnnotations(map[string]string{utils.AnnoKeyFolder: "abcdef"})

		err := builder.Validate(ctx, buildVariableAttributesForOp(admission.Create, v, nil), nil)
		require.Error(t, err)
		require.True(t, apierrors.IsBadRequest(err))
		require.Contains(t, err.Error(), `expected "status--abcdef"`)
	})
}

func TestDashboardsAPIBuilderValidateVariableUpdateScopeChangeRejected(t *testing.T) {
	oldVariable := newCustomVariable("region", "region")
	newVariable := newCustomVariable("region", "region")
	newVariable.SetAnnotations(map[string]string{utils.AnnoKeyFolder: "folder-a"})

	ctx := k8srequest.WithNamespace(context.Background(), "stacks-1")
	ctx = identity.WithRequester(ctx, &identity.StaticRequester{
		OrgRole: identity.RoleEditor,
		OrgID:   1,
	})

	builder := &DashboardsAPIBuilder{
		folderClientProvider: &staticHandlerProvider{handler: &variableFolderAccessHandler{}},
	}

	err := builder.Validate(ctx, buildVariableAttributesForOp(admission.Update, newVariable, oldVariable), nil)

	require.Error(t, err)
	require.True(t, apierrors.IsBadRequest(err))
	require.Contains(t, err.Error(), "folder scope cannot be changed")
}

func TestDashboardsAPIBuilderValidateVariableUpdateScopeChangeToGlobalRejected(t *testing.T) {
	oldVariable := newCustomVariable("region", "region")
	oldVariable.SetAnnotations(map[string]string{utils.AnnoKeyFolder: "folder-a"})
	newVariable := newCustomVariable("region", "region")

	ctx := k8srequest.WithNamespace(context.Background(), "stacks-1")
	ctx = identity.WithRequester(ctx, &identity.StaticRequester{
		OrgRole: identity.RoleEditor,
		OrgID:   1,
	})

	builder := &DashboardsAPIBuilder{
		folderClientProvider: &staticHandlerProvider{handler: &variableFolderAccessHandler{}},
	}

	err := builder.Validate(ctx, buildVariableAttributesForOp(admission.Update, newVariable, oldVariable), nil)

	require.Error(t, err)
	require.True(t, apierrors.IsBadRequest(err))
	require.Contains(t, err.Error(), "folder scope cannot be changed")
}

func TestDashboardsAPIBuilderValidateVariableUpdateRenameRejected(t *testing.T) {
	oldVariable := newCustomVariable("region", "region")
	newVariable := newCustomVariable("status", "region")

	ctx := k8srequest.WithNamespace(context.Background(), "stacks-1")
	ctx = identity.WithRequester(ctx, &identity.StaticRequester{
		OrgRole: identity.RoleEditor,
		OrgID:   1,
	})

	builder := &DashboardsAPIBuilder{
		folderClientProvider: &staticHandlerProvider{handler: &variableFolderAccessHandler{}},
	}

	err := builder.Validate(ctx, buildVariableAttributesForOp(admission.Update, newVariable, oldVariable), nil)

	require.Error(t, err)
	require.True(t, apierrors.IsBadRequest(err))
	require.Contains(t, err.Error(), "spec.spec.name cannot be changed")
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

func newCustomVariable(variableName, metadataName string) *dashv2beta1.Variable {
	customVariable := dashv2beta1.NewDashboardCustomVariableKind()
	customVariable.Spec.Name = variableName

	spec := dashv2beta1.NewVariableSpec()
	spec.CustomVariableKind = customVariable

	return &dashv2beta1.Variable{
		ObjectMeta: metav1.ObjectMeta{
			Name: metadataName,
		},
		Spec: *spec,
	}
}

func TestDeriveVariableMetadataName(t *testing.T) {
	t.Run("global scope uses spec name", func(t *testing.T) {
		require.Equal(t, "status", deriveVariableMetadataName("status", ""))
	})
	t.Run("folder scope appends folder uid with delimiter", func(t *testing.T) {
		require.Equal(t, "status--folder-a", deriveVariableMetadataName("status", "folder-a"))
	})
}

func TestValidateVariableMetadataName(t *testing.T) {
	t.Run("empty metadata name is allowed and will be derived by mutation", func(t *testing.T) {
		require.NoError(t, validateVariableMetadataName("", "status", "folder-a"))
	})
	t.Run("matching folder scoped metadata name is accepted", func(t *testing.T) {
		require.NoError(t, validateVariableMetadataName("status--folder-a", "status", "folder-a"))
	})
	t.Run("matching global metadata name is accepted", func(t *testing.T) {
		require.NoError(t, validateVariableMetadataName("status", "status", ""))
	})
	t.Run("mismatch returns actionable folder-scoped error", func(t *testing.T) {
		err := validateVariableMetadataName("status5", "status", "abcdef")
		require.Error(t, err)
		require.Contains(t, err.Error(), `expected "status--abcdef"`)
		require.Contains(t, err.Error(), "omit metadata.name")
	})
	t.Run("mismatch returns actionable global error", func(t *testing.T) {
		err := validateVariableMetadataName("status--abcdef", "status", "")
		require.Error(t, err)
		require.Contains(t, err.Error(), `expected "status"`)
	})
	t.Run("derived name longer than max length is rejected", func(t *testing.T) {
		tooLong := strings.Repeat("x", variableMetadataNameMaxLength)
		err := validateVariableMetadataName("", "status", tooLong)
		require.ErrorContains(t, err, "derived metadata.name exceeds maximum length")
	})
}

func buildVariableAttributesForOp(op admission.Operation, newVariable, oldVariable *dashv2beta1.Variable) admission.Attributes {
	switch op {
	case admission.Create:
		return admission.NewAttributesRecord(
			newVariable,
			nil,
			dashv2beta1.VariableResourceInfo.GroupVersionKind(),
			"stacks-1",
			newVariable.GetName(),
			dashv2beta1.VariableResourceInfo.GroupVersionResource(),
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
			dashv2beta1.VariableResourceInfo.GroupVersionKind(),
			"stacks-1",
			newVariable.GetName(),
			dashv2beta1.VariableResourceInfo.GroupVersionResource(),
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
			dashv2beta1.VariableResourceInfo.GroupVersionKind(),
			"stacks-1",
			oldVariable.GetName(),
			dashv2beta1.VariableResourceInfo.GroupVersionResource(),
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
func (m *variableFolderAccessHandler) Patch(_ context.Context, _ string, _ types.PatchType, _ []byte, _ int64, _ metav1.PatchOptions) (*unstructured.Unstructured, error) {
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
