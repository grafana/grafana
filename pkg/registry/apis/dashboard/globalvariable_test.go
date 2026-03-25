package dashboard

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apiserver/pkg/admission"

	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
)

func TestValidateGlobalVariable(t *testing.T) {
	t.Run("valid custom variable", func(t *testing.T) {
		gv := newCustomGlobalVariable("region", "region")
		require.NoError(t, validateGlobalVariable(gv))
	})

	t.Run("metadata and spec names can differ", func(t *testing.T) {
		gv := newCustomGlobalVariable("region", "env")
		require.NoError(t, validateGlobalVariable(gv))
	})

	t.Run("empty variable name is rejected", func(t *testing.T) {
		gv := newCustomGlobalVariable("", "")
		require.ErrorContains(t, validateGlobalVariable(gv), "variable name must not be empty")
	})

	t.Run("reserved prefix is rejected", func(t *testing.T) {
		gv := newCustomGlobalVariable("__region", "__region")
		require.ErrorContains(t, validateGlobalVariable(gv), "must not start with '__'")
	})

	t.Run("multiple variable kinds are rejected", func(t *testing.T) {
		gv := newCustomGlobalVariable("region", "region")
		queryVariable := dashv2beta1.NewDashboardQueryVariableKind()
		queryVariable.Spec.Name = "region"
		gv.Spec.QueryVariableKind = queryVariable

		require.ErrorContains(t, validateGlobalVariable(gv), "exactly one variable kind")
	})
}

func TestDashboardsAPIBuilderValidateGlobalVariable(t *testing.T) {
	builder := &DashboardsAPIBuilder{}
	gv := newCustomGlobalVariable("region", "region")

	err := builder.Validate(context.Background(), admission.NewAttributesRecord(
		gv,
		nil,
		dashv2beta1.GlobalVariableResourceInfo.GroupVersionKind(),
		"stacks-1",
		gv.GetName(),
		dashv2beta1.GlobalVariableResourceInfo.GroupVersionResource(),
		"",
		admission.Create,
		&metav1.CreateOptions{},
		false,
		nil,
	), nil)

	require.NoError(t, err)
}

func newCustomGlobalVariable(variableName, metadataName string) *dashv2beta1.GlobalVariable {
	customVariable := dashv2beta1.NewDashboardCustomVariableKind()
	customVariable.Spec.Name = variableName

	spec := dashv2beta1.NewGlobalVariableSpec()
	spec.CustomVariableKind = customVariable

	return &dashv2beta1.GlobalVariable{
		ObjectMeta: metav1.ObjectMeta{
			Name: metadataName,
		},
		Spec: *spec,
	}
}

func TestGlobalVariableNameUniquenessHelpers(t *testing.T) {
	t.Run("list options include folder label only for folder scope", func(t *testing.T) {
		globalScope := buildGlobalVariableNameListOptions("region", "")
		require.Equal(t, "spec.spec.name=region", globalScope.FieldSelector)
		require.Empty(t, globalScope.LabelSelector)

		folderScope := buildGlobalVariableNameListOptions("region", "folder-a")
		require.Equal(t, "spec.spec.name=region", folderScope.FieldSelector)
		require.Equal(t, globalVariableFolderLabelKey+"=folder-a", folderScope.LabelSelector)
	})

	t.Run("global scope ignores folder-scoped matches", func(t *testing.T) {
		list := &unstructured.UnstructuredList{
			Items: []unstructured.Unstructured{
				{
					Object: map[string]any{
						"metadata": map[string]any{
							"name": "folder-only",
							"labels": map[string]any{
								globalVariableFolderLabelKey: "folder-a",
							},
						},
					},
				},
			},
		}

		require.Empty(t, findGlobalVariableNameConflict(list, "", ""))
	})

	t.Run("folder scope checks only same folder and excludes current object", func(t *testing.T) {
		list := &unstructured.UnstructuredList{
			Items: []unstructured.Unstructured{
				{
					Object: map[string]any{
						"metadata": map[string]any{
							"name": "same-folder-conflict",
							"labels": map[string]any{
								globalVariableFolderLabelKey: "folder-a",
							},
						},
					},
				},
				{
					Object: map[string]any{
						"metadata": map[string]any{
							"name": "different-folder",
							"labels": map[string]any{
								globalVariableFolderLabelKey: "folder-b",
							},
						},
					},
				},
			},
		}

		require.Equal(t, "same-folder-conflict", findGlobalVariableNameConflict(list, "folder-a", ""))
		require.Empty(t, findGlobalVariableNameConflict(list, "folder-a", "same-folder-conflict"))
	})
}
