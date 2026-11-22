package provisioning

import (
	"testing"

	"github.com/stretchr/testify/assert"

	iam "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	folderapierrors "github.com/grafana/grafana/pkg/api/apierrors"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	foldermodel "github.com/grafana/grafana/pkg/services/folder"
)

// The app packages cannot import the main Grafana module, so they mirror what
// they need from it. These fail when the two drift apart.
func TestResourcesMirrorsFolderModel(t *testing.T) {
	assert.Equal(t, foldermodel.GeneralFolderUID, resources.GeneralFolderUID)
	for _, uid := range []string{"", foldermodel.GeneralFolderUID, foldermodel.SharedWithMeFolderUID, "some-folder"} {
		assert.Equal(t, foldermodel.ToLegacyFolderUID(uid), resources.ToLegacyFolderUID(uid), uid)
		assert.Equal(t, foldermodel.IsRootFolderUID(uid), resources.IsRootFolderUID(uid), uid)
	}

	assert.ErrorIs(t, foldermodel.ErrMaximumDepthReached.Errorf("too deep"), resources.ErrFolderMaximumDepthReached)
	assert.ErrorIs(t, foldermodel.ErrFolderNotEmpty.Errorf("not empty"), resources.ErrFolderNotEmpty)
	assert.True(t, resources.IsFolderDepthExceededAPIError(foldermodel.ErrMaximumDepthReached.Errorf("too deep")))
	assert.True(t, resources.IsFolderNotEmptyAPIError(foldermodel.ErrFolderNotEmpty.Errorf("not empty")))

	assert.Equal(t, foldermodel.ErrVersionMismatch.Error(), resources.FolderVersionMismatchMessage)
	statusErr := folderapierrors.ToFolderStatusError(foldermodel.ErrVersionMismatch)
	assert.Equal(t, resources.FolderVersionMismatchMessage, statusErr.Error())
}

func TestResourcesMirrorsUserResource(t *testing.T) {
	assert.Equal(t, iam.UserResourceInfo.GroupVersionResource(), resources.UserResource)
}

func TestJobsMirrorsFeatureFlags(t *testing.T) {
	assert.Equal(t, featuremgmt.FlagProvisioningExport, jobs.FlagProvisioningExport)
	assert.Equal(t, featuremgmt.FlagProvisioningPerformance, jobs.FlagProvisioningPerformance)
}
