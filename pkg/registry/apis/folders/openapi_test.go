package folders

import (
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	foldersv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
)

func TestPostProcessOpenAPI_StatusNotRequired(t *testing.T) {
	folderKey := foldersv1.OpenAPIPrefix + "Folder"
	oas := &spec3.OpenAPI{
		Info: &spec.Info{},
		Components: &spec3.Components{Schemas: map[string]*spec.Schema{
			folderKey: {SchemaProps: spec.SchemaProps{Required: []string{"metadata", "spec", "status"}}},
		}},
	}

	out, err := (&FolderAPIBuilder{}).PostProcessOpenAPI(oas)
	require.NoError(t, err)
	require.Equal(t, []string{"metadata", "spec"}, out.Components.Schemas[folderKey].Required)
}

func TestPostProcessOpenAPI_SharedRequiredSliceIsNotCorrupted(t *testing.T) {
	folderKey := foldersv1.OpenAPIPrefix + "Folder"
	shared := []string{"metadata", "spec", "status"}
	newOAS := func() *spec3.OpenAPI {
		return &spec3.OpenAPI{
			Info: &spec.Info{},
			Components: &spec3.Components{Schemas: map[string]*spec.Schema{
				folderKey: {SchemaProps: spec.SchemaProps{Required: shared}},
			}},
		}
	}

	first, err := (&FolderAPIBuilder{}).PostProcessOpenAPI(newOAS())
	require.NoError(t, err)
	second, err := (&FolderAPIBuilder{}).PostProcessOpenAPI(newOAS())
	require.NoError(t, err)

	require.Equal(t, []string{"metadata", "spec", "status"}, shared)
	require.Equal(t, []string{"metadata", "spec"}, first.Components.Schemas[folderKey].Required)
	require.Equal(t, []string{"metadata", "spec"}, second.Components.Schemas[folderKey].Required)
}
