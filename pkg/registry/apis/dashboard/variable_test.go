package dashboard

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apiserver/pkg/admission"

	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
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
