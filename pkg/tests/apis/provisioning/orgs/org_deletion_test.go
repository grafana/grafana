package orgs

import (
	"context"
	"fmt"
	"net/http"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/org"
	unified "github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func TestIntegration_OrgDeletionRemovesTheOrgRepositories(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	helper := sharedHelper(t)
	t.Cleanup(func() { helper.Cleanup(t) })

	const (
		doomedOrgName = "org-deletion"
		doomedRepo    = "doomed-repo"
		survivingRepo = "surviving-repo"
	)

	orgID := helper.CreateOrg(doomedOrgName)
	admin := helper.CreateUser("repo-admin", doomedOrgName, org.RoleAdmin, nil)
	orgHelper := helper.WithNamespace(t, helper.Namespacer(orgID), admin)

	orgHelper.CreateLocalRepo(t, common.TestRepo{
		Name:       doomedRepo,
		SyncTarget: "folder",
		LocalPath:  filepath.Join(helper.ProvisioningPath, doomedRepo),
		Copies: map[string]string{
			"../testdata/simple-dashboard.json": "team/dashboard.json",
		},
	})

	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       survivingRepo,
		SyncTarget: "folder",
		LocalPath:  filepath.Join(helper.ProvisioningPath, survivingRepo),
		SkipSync:   true,
	})

	// Read through the storage client: the org's own users can no longer sign in once it is gone.
	serviceCtx := identity.WithServiceIdentityContext(context.Background(), orgID)
	key := &resourcepb.ResourceKey{
		Namespace: helper.Namespacer(orgID),
		Group:     provisioning.GROUP,
		Resource:  provisioning.RepositoryResourceInfo.GetName(),
		Name:      doomedRepo,
	}
	_, err := helper.GetEnv().ResourceClient.Read(serviceCtx, &resourcepb.ReadRequest{Key: key})
	require.NoError(t, err, "the repository must exist before the org is deleted")

	response := apis.DoRequest(helper.K8sTestHelper, apis.RequestParams{
		User:   helper.Org1.Admin,
		Method: http.MethodDelete,
		Path:   fmt.Sprintf("/api/orgs/%d", orgID),
	}, &struct{}{})
	require.Equal(t, http.StatusOK, response.Response.StatusCode, string(response.Body))

	// Deletion is complete when the request returns: it waits for the repository
	// finalizers rather than leaving the teardown to the controller.
	_, err = helper.GetEnv().ResourceClient.Read(serviceCtx, &resourcepb.ReadRequest{Key: key})
	require.Error(t, err, "org deletion must remove the org's repositories")
	result := unified.AsErrorResult(err)
	require.NotNil(t, result)
	require.Equal(t, int32(http.StatusNotFound), result.Code)

	_, err = helper.Repositories.Resource.Get(t.Context(), survivingRepo, metav1.GetOptions{})
	require.NoError(t, err, "deleting an org must not touch another org's repositories")
}
