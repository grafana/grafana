package dashboard

import (
	"context"
	"errors"
	"strings"
	"sync"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	k8srequest "k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/apiserver/pkg/warning"

	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

type recordingPermissionsService struct {
	accesscontrol.PermissionsService
	mu        sync.Mutex
	calls     []recordingDeleteCall
	returnErr error
}

type recordingDeleteCall struct {
	orgID      int64
	resourceID string
}

func (r *recordingPermissionsService) DeleteResourcePermissions(_ context.Context, orgID int64, resourceID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.calls = append(r.calls, recordingDeleteCall{orgID: orgID, resourceID: resourceID})
	return r.returnErr
}

type recordingWarnings struct {
	mu       sync.Mutex
	warnings []string
}

func (r *recordingWarnings) AddWarning(_ string, text string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.warnings = append(r.warnings, text)
}

func newDashboardWithFolder(name, folder string) *unstructured.Unstructured {
	u := &unstructured.Unstructured{}
	u.SetGroupVersionKind(dashv1.DashboardResourceInfo.GroupVersionKind())
	u.SetName(name)
	u.SetNamespace("default")
	annotations := map[string]string{}
	if folder != "" {
		annotations[utils.AnnoKeyFolder] = folder
	}
	u.SetAnnotations(annotations)
	return u
}

type fakeStorage struct {
	grafanarest.Storage
	old runtime.Object
	err error
}

func (f *fakeStorage) Update(ctx context.Context, _ string, objInfo rest.UpdatedObjectInfo, _ rest.ValidateObjectFunc, _ rest.ValidateObjectUpdateFunc, _ bool, _ *metav1.UpdateOptions) (runtime.Object, bool, error) {
	if f.err != nil {
		return nil, false, f.err
	}
	newObj, err := objInfo.UpdatedObject(ctx, f.old)
	if err != nil {
		return nil, false, err
	}
	return newObj, false, nil
}

func newUpdateCtx() context.Context {
	return k8srequest.WithNamespace(context.Background(), "default")
}

func TestDashboardStorageWrapperUpdate_FolderUnchanged_NoPermissionDelete(t *testing.T) {
	const uid = "abc"
	permSvc := &recordingPermissionsService{}
	recorder := &recordingWarnings{}

	ctx := warning.WithWarningRecorder(newUpdateCtx(), recorder)

	old := newDashboardWithFolder(uid, "folder-a")
	updated := newDashboardWithFolder(uid, "folder-a")

	wrapper := dashboardStorageWrapper{
		Storage:                 &fakeStorage{old: old},
		dashboardPermissionsSvc: permSvc,
	}

	_, _, err := wrapper.Update(ctx, uid, rest.DefaultUpdatedObjectInfo(updated), nil, nil, false, &metav1.UpdateOptions{})
	require.NoError(t, err)
	require.Empty(t, permSvc.calls, "permissions must not be deleted when folder is unchanged")
	require.Empty(t, recorder.warnings, "no warning expected when folder is unchanged")
}

func TestDashboardStorageWrapperUpdate_FolderChanged_DeletesPermissionsAndWarns(t *testing.T) {
	const uid = "abc"
	permSvc := &recordingPermissionsService{}
	recorder := &recordingWarnings{}

	ctx := warning.WithWarningRecorder(newUpdateCtx(), recorder)

	old := newDashboardWithFolder(uid, "")           // was at root
	updated := newDashboardWithFolder(uid, "secret") // moved into a restricted folder

	wrapper := dashboardStorageWrapper{
		Storage:                 &fakeStorage{old: old},
		dashboardPermissionsSvc: permSvc,
	}

	_, _, err := wrapper.Update(ctx, uid, rest.DefaultUpdatedObjectInfo(updated), nil, nil, false, &metav1.UpdateOptions{})
	require.NoError(t, err)

	require.Len(t, permSvc.calls, 1, "permissions must be cleared on folder change")
	require.Equal(t, int64(1), permSvc.calls[0].orgID)
	require.Equal(t, uid, permSvc.calls[0].resourceID)

	require.Len(t, recorder.warnings, 1)
	require.True(t, strings.Contains(recorder.warnings[0], uid), "warning should reference the dashboard uid")
	require.True(t, strings.Contains(recorder.warnings[0], "secret"), "warning should reference the new folder")
}

func TestDashboardStorageWrapperUpdate_PermissionDeleteErrorPropagates(t *testing.T) {
	const uid = "abc"
	deleteErr := errors.New("rbac store offline")
	permSvc := &recordingPermissionsService{returnErr: deleteErr}
	recorder := &recordingWarnings{}

	ctx := warning.WithWarningRecorder(newUpdateCtx(), recorder)

	old := newDashboardWithFolder(uid, "folder-a")
	updated := newDashboardWithFolder(uid, "folder-b")

	wrapper := dashboardStorageWrapper{
		Storage:                 &fakeStorage{old: old},
		dashboardPermissionsSvc: permSvc,
	}

	_, _, err := wrapper.Update(ctx, uid, rest.DefaultUpdatedObjectInfo(updated), nil, nil, false, &metav1.UpdateOptions{})
	require.ErrorIs(t, err, deleteErr, "delete-permissions error must propagate so the caller knows cleanup failed")
	require.Len(t, permSvc.calls, 1)
	require.Empty(t, recorder.warnings)
}
