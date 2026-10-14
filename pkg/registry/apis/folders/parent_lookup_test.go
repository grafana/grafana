package folders

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/apiserver/pkg/endpoints/handlers/responsewriters"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

func parentLookupErrors() map[string]error {
	return map[string]error{
		"missing":        apierrors.NewNotFound(folders.FolderResourceInfo.GroupResource(), "ancestor"),
		"timeout":        apierrors.NewTimeoutError("storage timeout", 7),
		"server timeout": apierrors.NewServerTimeout(folders.FolderResourceInfo.GroupResource(), "get", 7),
		"unavailable":    apierrors.NewServiceUnavailable("storage unavailable"),
		"throttled":      apierrors.NewTooManyRequests("storage throttled", 7),
		"forbidden":      apierrors.NewForbidden(folders.FolderResourceInfo.GroupResource(), "ancestor", fmt.Errorf("access denied")),
		"internal":       apierrors.NewInternalError(fmt.Errorf("storage failure")),
		"plain error":    fmt.Errorf("storage failure"),
		"deadline":       context.DeadlineExceeded,
		"canceled":       context.Canceled,
	}
}

func folderWithParent(name, parent string) *folders.Folder {
	return &folders.Folder{
		ObjectMeta: metav1.ObjectMeta{
			Name:        name,
			Annotations: map[string]string{utils.AnnoKeyFolder: parent},
		},
		Spec: folders.FolderSpec{Title: name},
	}
}

func TestParentLookupResults(t *testing.T) {
	for name, lookupErr := range parentLookupErrors() {
		t.Run(name, func(t *testing.T) {
			storage := grafanarest.NewMockStorage(t)
			storage.On("Get", mock.Anything, "ancestor", &metav1.GetOptions{}).Return(nil, lookupErr).Once()
			result, err := newParentsGetter(storage, 5)(context.Background(), folderWithParent("child", "ancestor"))
			require.NoError(t, err)
			if apierrors.IsNotFound(lookupErr) {
				require.NoError(t, result.LookupError)
			} else {
				require.Equal(t, lookupErr, result.LookupError)
			}
			require.NotNil(t, result.Hierarchy)
			require.Equal(t, []folders.FolderInfo{
				{Name: "ancestor", Detached: true, Description: lookupErr.Error()},
				{Name: "child", Title: "child", Parent: "ancestor"},
			}, result.Hierarchy.Items)
		})
	}
}

func TestCreateParentLookupErrors(t *testing.T) {
	for name, lookupErr := range parentLookupErrors() {
		for _, dryRun := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s/dryRun=%t", name, dryRun), func(t *testing.T) {
				storage := grafanarest.NewMockStorage(t)
				storage.On("Get", mock.Anything, "parent", &metav1.GetOptions{}).
					Return(folderWithParent("parent", "ancestor"), nil).Once()
				storage.On("Get", mock.Anything, "ancestor", &metav1.GetOptions{}).Return(nil, lookupErr).Once()
				b := &FolderAPIBuilder{
					parents:              newParentsGetter(storage, 5),
					maxNestedFolderDepth: 5,
				}
				obj := folderWithParent("child", "parent")
				err := b.Validate(context.Background(), admission.NewAttributesRecord(
					obj, nil, folders.SchemeGroupVersion.WithKind("Folder"), "default", obj.Name,
					folders.SchemeGroupVersion.WithResource("folders"), "", admission.Create,
					nil, dryRun, &user.SignedInUser{},
				), nil)
				if apierrors.IsNotFound(lookupErr) {
					if dryRun {
						require.NoError(t, err)
					} else {
						require.True(t, apierrors.IsBadRequest(err), "expected BadRequest, got %v", err)
						require.ErrorContains(t, err, "ancestor")
					}
					return
				}
				require.Error(t, err)
				expected := resource.StatusErrorFromResponse(nil, lookupErr)
				require.Equal(t, responsewriters.ErrorToAPIStatus(expected), responsewriters.ErrorToAPIStatus(err))
			})
		}
	}
}

func TestCreateParentLookupWrongType(t *testing.T) {
	for _, dryRun := range []bool{false, true} {
		t.Run(fmt.Sprintf("dryRun=%t", dryRun), func(t *testing.T) {
			storage := grafanarest.NewMockStorage(t)
			storage.On("Get", mock.Anything, "parent", &metav1.GetOptions{}).
				Return(&unstructured.Unstructured{}, nil).Once()
			err := validateOnCreate(context.Background(), folderWithParent("child", "parent"), newParentsGetter(storage, 5), 5, dryRun)
			require.ErrorContains(t, err, "expected folder, found: *unstructured.Unstructured")
			require.Equal(t, int32(http.StatusInternalServerError), responsewriters.ErrorToAPIStatus(err).Code)
		})
	}
}

func TestParentsReadLookupErrors(t *testing.T) {
	for name, lookupErr := range parentLookupErrors() {
		t.Run(name, func(t *testing.T) {
			storage := grafanarest.NewMockStorage(t)
			storage.On("Get", mock.Anything, "child", &metav1.GetOptions{}).
				Return(folderWithParent("child", "parent"), nil).Once()
			storage.On("Get", mock.Anything, "parent", &metav1.GetOptions{}).
				Return(folderWithParent("parent", "ancestor"), nil).Once()
			storage.On("Get", mock.Anything, "ancestor", &metav1.GetOptions{}).Return(nil, lookupErr).Once()
			responder := &recordingResponder{}
			r := &subParentsREST{getter: storage, parents: newParentsGetter(storage, 5)}
			handler, err := r.Connect(context.Background(), "child", nil, responder)
			require.NoError(t, err)
			handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/child/parents", nil))
			require.NoError(t, responder.err)
			require.Equal(t, http.StatusOK, responder.status)
			require.Equal(t, []folders.FolderInfo{
				{Name: "ancestor", Detached: true, Description: lookupErr.Error()},
				{Name: "parent", Title: "parent", Parent: "ancestor"},
				{Name: "child", Title: "child", Parent: "parent"},
			}, responder.obj.(*folders.FolderInfoList).Items)
		})
	}
}

func TestParentsReadCycle(t *testing.T) {
	storage := grafanarest.NewMockStorage(t)
	storage.On("Get", mock.Anything, "child", &metav1.GetOptions{}).
		Return(folderWithParent("child", "parent"), nil).Once()
	storage.On("Get", mock.Anything, "parent", &metav1.GetOptions{}).
		Return(folderWithParent("parent", "child"), nil).Once()
	responder := &recordingResponder{}
	r := &subParentsREST{getter: storage, parents: newParentsGetter(storage, 5)}
	handler, err := r.Connect(context.Background(), "child", nil, responder)
	require.NoError(t, err)
	handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/child/parents", nil))
	require.ErrorContains(t, responder.err, "cyclic folder references found")
	require.Nil(t, responder.obj)
}

func TestCreateDryRunCycle(t *testing.T) {
	storage := grafanarest.NewMockStorage(t)
	storage.On("Get", mock.Anything, "parent", &metav1.GetOptions{}).
		Return(folderWithParent("parent", "child"), nil).Once()
	err := validateOnCreate(context.Background(), folderWithParent("child", "parent"), newParentsGetter(storage, 5), 5, true)
	require.ErrorContains(t, err, "cyclic folder references found")
}

func TestMoveKeepsPartialParentLookupBehavior(t *testing.T) {
	for name, lookupErr := range parentLookupErrors() {
		t.Run(name, func(t *testing.T) {
			storage := grafanarest.NewMockStorage(t)
			storage.On("Get", mock.Anything, "old-parent", &metav1.GetOptions{}).
				Return(folderWithParent("old-parent", "old-grandparent"), nil).Twice()
			storage.On("Get", mock.Anything, "old-grandparent", &metav1.GetOptions{}).
				Return(folderWithParent("old-grandparent", "missing-old"), nil).Twice()
			storage.On("Get", mock.Anything, "missing-old", &metav1.GetOptions{}).Return(nil, lookupErr).Twice()
			storage.On("Get", mock.Anything, "target", &metav1.GetOptions{}).
				Return(folderWithParent("target", "missing-new"), nil).Once()
			storage.On("Get", mock.Anything, "missing-new", &metav1.GetOptions{}).Return(nil, lookupErr).Once()
			// The old partial chain is deeper than the new one, so the existing
			// canSkipChildrenCheck optimization should still avoid a search.
			err := validateOnUpdate(context.Background(), folderWithParent("child", "target"),
				folderWithParent("child", "old-parent"), storage, newParentsGetter(storage, 5), nil, nil, 5)
			require.NoError(t, err)
		})
	}
}
