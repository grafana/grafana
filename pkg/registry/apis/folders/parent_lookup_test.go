package folders

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
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
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func parentLookupErrors() map[string]error {
	return map[string]error{
		"missing":     apierrors.NewNotFound(folders.FolderResourceInfo.GroupResource(), "ancestor"),
		"timeout":     apierrors.NewTimeoutError("storage timeout", 7),
		"plain error": fmt.Errorf("storage failure"),
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

func TestCreateParentLookupErrors(t *testing.T) {
	for name, lookupErr := range parentLookupErrors() {
		for _, dryRun := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s/dryRun=%t", name, dryRun), func(t *testing.T) {
				storage := grafanarest.NewMockStorage(t)
				storage.On("Get", mock.Anything, "parent", &metav1.GetOptions{}).
					Return(folderWithParent("parent", "ancestor"), nil).Once()
				storage.On("Get", mock.Anything, "ancestor", &metav1.GetOptions{}).Return(nil, lookupErr).Once()
				b := &FolderAPIBuilder{
					parents:              newParentsGetter(storage),
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

func TestCreateParentLookupTransportStatuses(t *testing.T) {
	failure := &resourcepb.ErrorResult{
		Code:    http.StatusTooManyRequests,
		Reason:  string(metav1.StatusReasonTooManyRequests),
		Message: "parent lookup failed",
		Details: &resourcepb.ErrorDetails{Group: "folder.grafana.app", Kind: "folders", Name: "ancestor", RetryAfterSeconds: 7},
	}
	transport, err := status.New(codes.ResourceExhausted, "private transport details").WithDetails(failure)
	require.NoError(t, err)
	embedded := resource.ErrorFromResponse(failure, nil)

	for _, tc := range []struct {
		name     string
		err      error
		ancestor bool
		dryRun   bool
		code     int32
	}{
		{"direct parent unavailable", status.Error(codes.Unavailable, "private transport details"), false, false, http.StatusServiceUnavailable},
		{"ancestor throttled", transport.Err(), true, false, http.StatusTooManyRequests},
		{"dry-run wrapped transport", fmt.Errorf("read failed: %w", transport.Err()), false, true, http.StatusTooManyRequests},
		{"response-embedded failure", embedded, true, false, http.StatusTooManyRequests},
		{"dry-run deadline", context.DeadlineExceeded, false, true, http.StatusGatewayTimeout},
	} {
		t.Run(tc.name, func(t *testing.T) {
			store := grafanarest.NewMockStorage(t)
			parent := "ancestor"
			if tc.ancestor {
				parent = "parent"
				store.On("Get", mock.Anything, parent, &metav1.GetOptions{}).
					Return(folderWithParent(parent, "ancestor"), nil).Once()
			}
			store.On("Get", mock.Anything, "ancestor", &metav1.GetOptions{}).Return(nil, tc.err).Once()
			err := validateOnCreate(context.Background(), folderWithParent("child", parent), newParentsGetter(store), 5, tc.dryRun)
			require.IsType(t, &apierrors.StatusError{}, err)
			apiStatus := responsewriters.ErrorToAPIStatus(err)
			require.Equal(t, tc.code, apiStatus.Code)
			if tc.code == http.StatusTooManyRequests {
				require.Equal(t, responsewriters.ErrorToAPIStatus(embedded), apiStatus)
			} else {
				require.Equal(t, http.StatusText(int(tc.code)), apiStatus.Message)
				require.Nil(t, apiStatus.Details)
			}
		})
	}
}

func TestCreateParentLookupWrongType(t *testing.T) {
	for _, dryRun := range []bool{false, true} {
		t.Run(fmt.Sprintf("dryRun=%t", dryRun), func(t *testing.T) {
			storage := grafanarest.NewMockStorage(t)
			storage.On("Get", mock.Anything, "parent", &metav1.GetOptions{}).
				Return(&unstructured.Unstructured{}, nil).Once()
			err := validateOnCreate(context.Background(), folderWithParent("child", "parent"), newParentsGetter(storage), 5, dryRun)
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
			r := &subParentsREST{getter: storage, parents: newParentsGetter(storage)}
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
	r := &subParentsREST{getter: storage, parents: newParentsGetter(storage)}
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
	err := validateOnCreate(context.Background(), folderWithParent("child", "parent"), newParentsGetter(storage), 5, true)
	require.ErrorContains(t, err, "cyclic folder references found")
}

func TestMoveKeepsPartialParentLookupBehavior(t *testing.T) {
	lookupErr := apierrors.NewServiceUnavailable("storage unavailable")
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
		folderWithParent("child", "old-parent"), storage, newParentsGetter(storage), nil, nil, 5)
	require.NoError(t, err)
}
