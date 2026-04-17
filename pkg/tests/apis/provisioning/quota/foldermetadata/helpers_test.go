package foldermetadata

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// Folder metadata is enabled by default — we intentionally omit
// common.WithoutProvisioningFolderMetadata so that _folder.json files
// are honoured during sync.
var env = common.NewSharedGitEnv()

func sharedGitHelper(t *testing.T) *common.GitTestHelper {
	t.Helper()
	helper := env.GetCleanHelper(t)
	helper.SetQuotaStatus(provisioning.QuotaStatus{})
	return helper
}

func sharedGitHelperWithQuota(t *testing.T, maxResources int64) *common.GitTestHelper {
	t.Helper()
	helper := env.GetCleanHelper(t)
	helper.SetQuotaStatus(provisioning.QuotaStatus{MaxResourcesPerRepository: maxResources})
	return helper
}

func TestMain(m *testing.M) {
	env.RunTestMain(m)
}

func folderMetadataJSON(uid, title string) []byte {
	folder := map[string]any{
		"apiVersion": "folder.grafana.app/v1",
		"kind":       "Folder",
		"metadata": map[string]any{
			"name": uid,
		},
		"spec": map[string]any{
			"title": title,
		},
	}
	data, _ := json.MarshalIndent(folder, "", "\t")
	return data
}

func requireFolderNotExists(t *testing.T, helper *common.GitTestHelper, folderUID string) {
	t.Helper()
	_, err := helper.Folders.Resource.Get(context.Background(), folderUID, metav1.GetOptions{})
	require.True(t, apierrors.IsNotFound(err), "folder %s should not exist, got: %v", folderUID, err)
}
