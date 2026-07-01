package openapi

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/kube-openapi/pkg/spec3"
)

func TestRewriteAppInstance(t *testing.T) {
	const path = "/apis/example-app/v0alpha1/namespaces/{namespace}/app"

	newOAS := func(paths map[string]*spec3.Path) *spec3.OpenAPI {
		return &spec3.OpenAPI{
			Paths: &spec3.Paths{Paths: paths},
		}
	}
	nameParam := &spec3.Parameter{ParameterProps: spec3.ParameterProps{Name: "name", In: "path"}}
	namespaceParam := &spec3.Parameter{ParameterProps: spec3.ParameterProps{Name: "namespace", In: "path"}}

	t.Run("removes the collection path", func(t *testing.T) {
		oas := newOAS(map[string]*spec3.Path{
			path: {PathProps: spec3.PathProps{Get: &spec3.Operation{}}},
		})

		RewriteAppInstance(oas, path)

		_, exists := oas.Paths.Paths[path]
		assert.False(t, exists, "collection path should be deleted")
	})

	t.Run("rewrites /{name} to /instance", func(t *testing.T) {
		oas := newOAS(map[string]*spec3.Path{
			path + "/{name}": {PathProps: spec3.PathProps{Get: &spec3.Operation{}}},
		})

		RewriteAppInstance(oas, path)

		_, oldExists := oas.Paths.Paths[path+"/{name}"]
		assert.False(t, oldExists, "parameterised path should be removed")
		_, newExists := oas.Paths.Paths[path+"/instance"]
		assert.True(t, newExists, "instance path should be registered")
	})

	t.Run("rewrites subresource paths", func(t *testing.T) {
		oas := newOAS(map[string]*spec3.Path{
			path + "/{name}/health":           {PathProps: spec3.PathProps{Get: &spec3.Operation{}}},
			path + "/{name}/resources":        {PathProps: spec3.PathProps{Get: &spec3.Operation{}}},
			path + "/{name}/resources/{path}": {PathProps: spec3.PathProps{Get: &spec3.Operation{}}},
			path + "/{name}/proxy":            {PathProps: spec3.PathProps{Post: &spec3.Operation{}}},
		})

		RewriteAppInstance(oas, path)

		for _, want := range []string{
			path + "/instance/health",
			path + "/instance/resources",
			path + "/instance/resources/{path}",
			path + "/instance/proxy",
		} {
			_, ok := oas.Paths.Paths[want]
			assert.Truef(t, ok, "expected rewritten path %q", want)
		}
		for _, gone := range []string{
			path + "/{name}/health",
			path + "/{name}/resources",
			path + "/{name}/resources/{path}",
			path + "/{name}/proxy",
		} {
			_, ok := oas.Paths.Paths[gone]
			assert.Falsef(t, ok, "expected parameterised path %q to be removed", gone)
		}
	})

	t.Run("strips only the name parameter", func(t *testing.T) {
		oas := newOAS(map[string]*spec3.Path{
			path + "/{name}/health": {
				PathProps: spec3.PathProps{
					Parameters: []*spec3.Parameter{namespaceParam, nameParam},
					Get:        &spec3.Operation{},
				},
			},
		})

		RewriteAppInstance(oas, path)

		got := oas.Paths.Paths[path+"/instance/health"]
		require.NotNil(t, got)
		require.Len(t, got.Parameters, 1)
		assert.Equal(t, "namespace", got.Parameters[0].Name)
	})

	t.Run("leaves unrelated paths untouched", func(t *testing.T) {
		other := "/apis/other-group/v0alpha1/namespaces/{namespace}/widgets/{name}"
		oas := newOAS(map[string]*spec3.Path{
			path + "/{name}/health": {PathProps: spec3.PathProps{Get: &spec3.Operation{}}},
			other: {
				PathProps: spec3.PathProps{
					Parameters: []*spec3.Parameter{nameParam},
					Get:        &spec3.Operation{},
				},
			},
		})

		RewriteAppInstance(oas, path)

		widget, ok := oas.Paths.Paths[other]
		require.True(t, ok, "unrelated path should still exist")
		require.Len(t, widget.Parameters, 1, "unrelated path parameters should be untouched")
		assert.Equal(t, "name", widget.Parameters[0].Name)
	})

	t.Run("returns the same instance", func(t *testing.T) {
		oas := newOAS(map[string]*spec3.Path{})
		assert.Same(t, oas, RewriteAppInstance(oas, path))
	})
}
