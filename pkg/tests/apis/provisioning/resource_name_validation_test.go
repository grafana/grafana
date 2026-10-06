package provisioning

import (
	"fmt"
	"net/http"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func invalidResourceNameCases() []struct {
	path string
	name string
	data []byte
} {
	const invalidName = "Player Resolver (ext_proc)"
	longName := strings.Repeat("a", 254)
	return []struct {
		path string
		name string
		data []byte
	}{
		{
			path: "invalid-dashboard.json",
			name: invalidName,
			data: []byte(fmt.Sprintf(`{"apiVersion":"dashboard.grafana.app/v0alpha1","kind":"Dashboard","metadata":{"name":%q},"spec":{"title":"Invalid name"}}`, invalidName)),
		},
		{
			path: "invalid-classic-dashboard.json",
			name: invalidName,
			data: common.DashboardJSON(invalidName, "Invalid classic UID", 1),
		},
		{
			path: "invalid-generated-name.json",
			name: invalidName,
			data: []byte(fmt.Sprintf(`{"apiVersion":"dashboard.grafana.app/v0alpha1","kind":"Dashboard","metadata":{"generateName":%q},"spec":{"title":"Invalid generated name"}}`, invalidName)),
		},
		{
			path: "name-too-long.json",
			name: longName,
			data: common.DashboardJSON(longName, "UID too long", 1),
		},
	}
}

func TestIntegrationProvisioning_FullSync_InvalidResourceNames(t *testing.T) {
	helper := sharedHelper(t)
	const repo = "invalid-resource-names-sync"
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       repo,
		SyncTarget: "folder",
		SkipSync:   true,
	})

	tests := invalidResourceNameCases()
	for _, tt := range tests {
		helper.WriteToProvisioningPath(t, tt.path, tt.data)
	}
	const validName = "valid-resource-name"
	helper.WriteToProvisioningPath(t, "valid-dashboard.json", common.DashboardJSON(validName, "Valid dashboard", 1))

	job := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
		Action: provisioning.JobActionPull,
		Pull:   &provisioning.SyncJobOptions{},
	})
	jobObj := &provisioning.Job{}
	require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj))
	require.Equal(t, provisioning.JobStateWarning, jobObj.Status.State)
	require.Empty(t, jobObj.Status.Errors)
	require.Len(t, jobObj.Status.Warnings, len(tests))
	for _, tt := range tests {
		common.RequireJobWarningContains(t, jobObj, fmt.Sprintf("writing resource from file %s: failed to parse file: resource validation failed: metadata.name: Invalid value:", tt.path))
		common.RequireJobWarningContains(t, jobObj, tt.name)
	}

	dashboards := helper.RequireRepoDashboardCount(t, repo, 1)
	require.Equal(t, validName, dashboards[0].GetName())
	helper.WaitForConditionReason(t, repo, provisioning.ConditionTypePullStatus, provisioning.ReasonCompletedWithWarnings)
}

func TestIntegrationProvisioning_Files_InvalidResourceNames(t *testing.T) {
	helper := sharedHelper(t)
	const repo = "invalid-resource-names-files"
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       repo,
		SyncTarget: "folder",
		Workflows:  []string{"write"},
		SkipSync:   true,
	})

	for _, tt := range invalidResourceNameCases() {
		t.Run(tt.path, func(t *testing.T) {
			var statusCode int
			result := helper.AdminREST.Post().
				Namespace(helper.Namespace).
				Resource("repositories").
				Name(repo).
				SubResource("files", tt.path).
				Param("skipDryRun", "true").
				Body(tt.data).
				SetHeader("Content-Type", "application/json").
				Do(t.Context()).StatusCode(&statusCode)

			err := result.Error()
			require.Equal(t, http.StatusBadRequest, statusCode, "unexpected response: %v", err)
			require.True(t, apierrors.IsBadRequest(err), "expected BadRequest, got: %v", err)
			require.ErrorContains(t, err, "resource validation failed: metadata.name: Invalid value:")
			require.ErrorContains(t, err, tt.name)
			require.NoFileExists(t, filepath.Join(helper.ProvisioningPath, tt.path))
		})
	}
	helper.RequireRepoDashboardCount(t, repo, 0)
}
