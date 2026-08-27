package dashboard

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	requestcontext "k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	dashboardV0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/libraryelements"
	"github.com/grafana/grafana/pkg/services/libraryelements/model"
)

func TestLibraryPanelStoreTranslatesMissingFolderAsNotFound(t *testing.T) {
	store := &LibraryPanelStore{ResourceInfo: dashboardV0.LibraryPanelResourceInfo}

	err := store.translateLegacyError("panel-a", dashboards.ErrFolderNotFound)

	require.True(t, apierrors.IsNotFound(err))
	var statusError *apierrors.StatusError
	require.ErrorAs(t, err, &statusError)
	require.Equal(t, "folder.grafana.app", statusError.Status().Details.Group)
}

type staticLibraryPanelAccess struct {
	panel *dashboardV0.LibraryPanel
}

func (a staticLibraryPanelAccess) GetLibraryPanels(context.Context, legacy.LibraryPanelQuery) (*dashboardV0.LibraryPanelList, error) {
	return &dashboardV0.LibraryPanelList{Items: []dashboardV0.LibraryPanel{*a.panel.DeepCopy()}}, nil
}

type recordingLibraryPanelService struct {
	libraryelements.Service
	patch model.PatchLibraryElementCommand
}

func (s *recordingLibraryPanelService) PatchLibraryElement(_ context.Context, _ identity.Requester, cmd model.PatchLibraryElementCommand, uid string) (model.LibraryElementDTO, error) {
	s.patch = cmd
	return model.LibraryElementDTO{UID: uid}, nil
}

func TestLibraryPanelStorePreservesPatchSourceFolder(t *testing.T) {
	panel := &dashboardV0.LibraryPanel{
		TypeMeta: metav1.TypeMeta{APIVersion: dashboardV0.APIVERSION, Kind: "LibraryPanel"},
		ObjectMeta: metav1.ObjectMeta{
			Name:       "panel-a",
			Generation: 1,
			Annotations: map[string]string{
				utils.AnnoKeyFolder: "source",
			},
		},
		Spec: dashboardV0.LibraryPanelSpec{
			Type:       "text",
			Title:      "Panel",
			PanelTitle: "Panel",
		},
	}
	service := &recordingLibraryPanelService{}
	store := &LibraryPanelStore{
		Access:       staticLibraryPanelAccess{panel: panel},
		ResourceInfo: dashboardV0.LibraryPanelResourceInfo,
		service:      service,
	}
	patchInfo := rest.DefaultUpdatedObjectInfo(nil, func(_ context.Context, _ runtime.Object, oldObj runtime.Object) (runtime.Object, error) {
		updated := oldObj.(*dashboardV0.LibraryPanel)
		updated.Annotations[utils.AnnoKeyFolder] = "destination"
		return updated, nil
	})
	ctx := requestcontext.WithNamespace(context.Background(), "stacks-1")
	ctx = identity.WithRequester(ctx, &identity.StaticRequester{OrgID: 1})

	_, _, err := store.Update(ctx, panel.Name, patchInfo, nil, nil, false, &metav1.UpdateOptions{})

	require.NoError(t, err)
	require.NotNil(t, service.patch.FolderUID)
	require.Equal(t, "destination", *service.patch.FolderUID)
	require.Equal(t, "source", panel.Annotations[utils.AnnoKeyFolder])
}
