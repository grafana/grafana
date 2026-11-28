package conflict

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// A job is authorized when it is created, so its spec must not change afterwards.
// Otherwise a user could queue a job they are allowed to run, then rewrite it to
// one they are not allowed to run before the driver claims it. This package runs
// without controllers, so the job stays pending while the test updates it.
func TestIntegrationProvisioning_JobSpecImmutable(t *testing.T) {
	helper := sharedHelper(t)

	created, err := helper.Jobs.Resource.Create(t.Context(), &unstructured.Unstructured{
		Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Job",
			"metadata":   map[string]any{"name": "test-job-immutable-spec", "namespace": "default"},
			"spec": map[string]any{
				"action":     string(provisioning.JobActionPull),
				"repository": "test-repo",
				"pull":       map[string]any{"incremental": false},
			},
		},
	}, metav1.CreateOptions{})
	require.NoError(t, err)
	t.Cleanup(func() {
		_ = helper.Jobs.Resource.Delete(t.Context(), created.GetName(), metav1.DeleteOptions{})
	})

	changed := created.DeepCopy()
	require.NoError(t, unstructured.SetNestedField(changed.Object, true, "spec", "pull", "incremental"))

	t.Run("editor cannot change the spec", func(t *testing.T) {
		var statusCode int
		result := helper.EditorREST.Put().
			Namespace("default").
			Resource("jobs").
			Name(created.GetName()).
			Body(common.AsJSON(changed.Object)).
			SetHeader("Content-Type", "application/json").
			Do(t.Context()).StatusCode(&statusCode)

		require.Error(t, result.Error(), "editor should not be able to change the spec of a queued job")
		require.Equal(t, http.StatusForbidden, statusCode)
		require.True(t, apierrors.IsForbidden(result.Error()))
	})

	t.Run("admin cannot change the spec either", func(t *testing.T) {
		latest, err := helper.Jobs.Resource.Get(t.Context(), created.GetName(), metav1.GetOptions{})
		require.NoError(t, err)
		require.NoError(t, unstructured.SetNestedField(latest.Object, true, "spec", "pull", "incremental"))

		_, err = helper.Jobs.Resource.Update(t.Context(), latest, metav1.UpdateOptions{})
		require.Error(t, err)
		require.True(t, apierrors.IsForbidden(err), "expected forbidden, got %v", err)
	})

	t.Run("spec is unchanged", func(t *testing.T) {
		got, err := helper.Jobs.Resource.Get(t.Context(), created.GetName(), metav1.GetOptions{})
		require.NoError(t, err)
		incremental, _, err := unstructured.NestedBool(got.Object, "spec", "pull", "incremental")
		require.NoError(t, err)
		require.False(t, incremental)
	})
}
