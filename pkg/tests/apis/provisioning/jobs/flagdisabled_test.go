package jobs

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func TestIntegrationProvisioning_FixFolderMetadataJobFlagDisabled(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	const repo = "fixfoldermeta-flag-disabled"
	testRepo := common.TestRepo{
		Name:               repo,
		SyncTarget:         "folder",
		Workflows:          []string{"write"},
		Copies:             map[string]string{},
		ExpectedDashboards: 0,
		ExpectedFolders:    1,
	}
	helper.CreateLocalRepo(t, testRepo)

	body := common.AsJSON(provisioning.JobSpec{
		Action: provisioning.JobActionFixFolderMetadata,
	})

	t.Run("admin cannot create fixFolderMetadata job when flag is disabled", func(t *testing.T) {
		var statusCode int
		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("jobs").
			Body(body).
			SetHeader("Content-Type", "application/json").
			Do(ctx).StatusCode(&statusCode)

		require.Error(t, result.Error(), "should fail when flag is disabled")
		require.Equal(t, http.StatusBadRequest, statusCode, "should return 400 Bad Request")
		require.True(t, apierrors.IsBadRequest(result.Error()), "error should be bad request")
	})
}
