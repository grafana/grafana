package provisioning

import (
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationProvisioning_RepositoryDeletionStatus_RoundTrips verifies that the
// structured status.deletion field is served by the aggregated apiserver and
// round-trips intact through a real status-subresource write. This is the
// end-to-end guard the controller unit tests cannot provide: it proves the new
// nested field (and every sub-field of DeletionStatus/DeletionError/
// DeletionErrorTarget) is present in the served OpenAPI schema and is not pruned
// by structural-schema enforcement on the way in or out.
func TestIntegrationProvisioning_RepositoryDeletionStatus_RoundTrips(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	helper := sharedHelper(t)

	const repoName = "git-deletion-status-roundtrip"
	repoObj := helper.RenderObject(t, common.TestdataPath("git.json.tmpl"), map[string]any{
		"Name":          repoName,
		"Branch":        "main",
		"WorkflowsJSON": `[]`,
	})
	_, err := helper.Repositories.Resource.Create(t.Context(), repoObj, metav1.CreateOptions{})
	require.NoError(t, err, "failed to create git repository")

	// Wait for the controller to write its initial conditions so the status
	// subresource exists before we patch it.
	waitForConditionTypes(t, helper.Repositories, repoName, repositoryConditions,
		provisioning.ConditionTypeReady,
	)

	// A freshly created repository has no deletion status: the field is
	// omitempty and must be absent until deletion actually wedges.
	created, err := helper.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
	require.NoError(t, err)
	require.Nil(t, common.MustFromUnstructured[provisioning.Repository](t, created).Status.Deletion,
		"a fresh repository must not have a deletion status")

	// Write a fully populated structured deletion status through the status
	// subresource, mirroring exactly what the controller records when a
	// finalizer wedges deletion.
	want := provisioning.DeletionStatus{
		State: provisioning.DeletionStateBlocked,
		Errors: []provisioning.DeletionError{{
			Code:      provisioning.DeletionErrorWebhookRemovalFailed,
			Detail:    "execute deletion hooks: delete webhook: access to the repository was lost",
			Finalizer: repository.CleanFinalizer,
			Target: &provisioning.DeletionErrorTarget{
				Group:    provisioning.GROUP,
				Resource: "repositories",
				Name:     repoName,
			},
		}},
	}
	patch := mustMarshalJSONPatch(t, []map[string]any{
		{"op": "add", "path": "/status/deletion", "value": want},
	})
	_, err = helper.Repositories.Resource.Patch(t.Context(), repoName, types.JSONPatchType, patch, metav1.PatchOptions{}, "status")
	require.NoError(t, err, "writing a structured deletion status must succeed")

	updated, err := helper.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
	require.NoError(t, err, "failed to get repository after the deletion status patch")
	got := common.MustFromUnstructured[provisioning.Repository](t, updated).Status.Deletion

	require.NotNil(t, got, "deletion status must be served back, not pruned")
	require.Equal(t, provisioning.DeletionStateBlocked, got.State)
	require.Len(t, got.Errors, 1, "the single blocking error must round-trip")
	require.Equal(t, want.Errors[0].Code, got.Errors[0].Code)
	require.Equal(t, want.Errors[0].Detail, got.Errors[0].Detail)
	require.Equal(t, want.Errors[0].Finalizer, got.Errors[0].Finalizer)
	require.NotNil(t, got.Errors[0].Target, "the error target must round-trip, not be pruned")
	require.Equal(t, want.Errors[0].Target.Group, got.Errors[0].Target.Group)
	require.Equal(t, want.Errors[0].Target.Resource, got.Errors[0].Target.Resource)
	require.Equal(t, want.Errors[0].Target.Name, got.Errors[0].Target.Name)
}
