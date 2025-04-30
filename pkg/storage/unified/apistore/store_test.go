// SPDX-License-Identifier: AGPL-3.0-only
// Provenance-includes-location: https://github.com/kubernetes/kubernetes/blob/master/staging/src/k8s.io/apiserver/pkg/storage/cacher/cacher_test.go
// Provenance-includes-license: Apache-2.0
// Provenance-includes-copyright: The Kubernetes Authors.

package apistore_test

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	utilruntime "k8s.io/apimachinery/pkg/util/runtime"
	"k8s.io/apiserver/pkg/apis/example"
	examplev1 "k8s.io/apiserver/pkg/apis/example/v1"
	"k8s.io/apiserver/pkg/storage"
	"k8s.io/apiserver/pkg/storage/storagebackend"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	storagetesting "github.com/grafana/grafana/pkg/apiserver/storage/testing"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

func init() {
	metav1.AddToGroupVersion(scheme, metav1.SchemeGroupVersion)
	utilruntime.Must(example.AddToScheme(scheme))
	utilruntime.Must(examplev1.AddToScheme(scheme))

	// Make sure there is a user in every context
	storagetesting.NewContext = func() context.Context {
		testUserA := &identity.StaticRequester{
			Type:           claims.TypeUser,
			Login:          "testuser",
			UserID:         123,
			UserUID:        "u123",
			OrgRole:        identity.RoleAdmin,
			IsGrafanaAdmin: true, // can do anything
		}
		return identity.WithRequester(context.Background(), testUserA)
	}
}

// GetPodAttrs returns labels and fields of a given object for filtering purposes.
func GetPodAttrs(obj runtime.Object) (labels.Set, fields.Set, error) {
	pod, ok := obj.(*example.Pod)
	if !ok {
		return nil, nil, fmt.Errorf("not a pod")
	}
	return labels.Set(pod.Labels), PodToSelectableFields(pod), nil
}

// PodToSelectableFields returns a field set that represents the object
// TODO: fields are not labels, and the validation rules for them do not apply.
func PodToSelectableFields(pod *example.Pod) fields.Set {
	// The purpose of allocation with a given number of elements is to reduce
	// amount of allocations needed to create the fields.Set. If you add any
	// field here or the number of object-meta related fields changes, this should
	// be adjusted.
	podSpecificFieldsSet := make(fields.Set, 5)
	podSpecificFieldsSet["spec.nodeName"] = pod.Spec.NodeName
	podSpecificFieldsSet["spec.restartPolicy"] = string(pod.Spec.RestartPolicy)
	podSpecificFieldsSet["status.phase"] = string(pod.Status.Phase)
	return AddObjectMetaFieldsSet(podSpecificFieldsSet, &pod.ObjectMeta, true)
}

func AddObjectMetaFieldsSet(source fields.Set, objectMeta *metav1.ObjectMeta, hasNamespaceField bool) fields.Set {
	source["metadata.name"] = objectMeta.Name
	if hasNamespaceField {
		source["metadata.namespace"] = objectMeta.Namespace
	}
	return source
}

func checkStorageInvariants(s storage.Interface) storagetesting.KeyValidation {
	return func(ctx context.Context, t *testing.T, key string) {
		obj := &example.Pod{}
		err := s.Get(ctx, key, storage.GetOptions{}, obj)
		if err != nil {
			t.Fatalf("Get failed: %v", err)
		}
	}
}

func TestCreate(t *testing.T) {
	ctx, store, destroyFunc, err := testSetup(t)
	defer destroyFunc()
	assert.NoError(t, err)
	storagetesting.RunTestCreate(ctx, t, store, checkStorageInvariants(store))
}

// No TTL support in unifed storage
// func TestCreateWithTTL(t *testing.T) {
// 	ctx, store, destroyFunc, err := testSetup(t)
// 	defer destroyFunc()
// 	assert.NoError(t, err)
// 	storagetesting.RunTestCreateWithTTL(ctx, t, store)
// }

func TestCreateWithKeyExist(t *testing.T) {
	ctx, store, destroyFunc, err := testSetup(t)
	defer destroyFunc()
	assert.NoError(t, err)
	storagetesting.RunTestCreateWithKeyExist(ctx, t, store)
}

func TestValidUpdate(t *testing.T) {
	ctx, store, destroyFunc, err := testSetup(t)
	defer destroyFunc()
	assert.NoError(t, err)
	storagetesting.RunTestValidUpdate(ctx, t, store)
}

func TestGet(t *testing.T) {
	ctx, store, destroyFunc, err := testSetup(t)
	defer destroyFunc()
	assert.NoError(t, err)
	storagetesting.RunTestGet(ctx, t, store)
}

func TestUnconditionalDelete(t *testing.T) {
	ctx, store, destroyFunc, err := testSetup(t)
	defer destroyFunc()
	assert.NoError(t, err)
	storagetesting.RunTestUnconditionalDelete(ctx, t, store)
}

func TestConditionalDelete(t *testing.T) {
	ctx, store, destroyFunc, err := testSetup(t)
	defer destroyFunc()
	assert.NoError(t, err)
	storagetesting.RunTestConditionalDelete(ctx, t, store)
}

func TestDeleteWithSuggestion(t *testing.T) {
	ctx, store, destroyFunc, err := testSetup(t)
	defer destroyFunc()
	assert.NoError(t, err)
	storagetesting.RunTestDeleteWithSuggestion(ctx, t, store)
}

func TestDeleteWithSuggestionAndConflict(t *testing.T) {
	ctx, store, destroyFunc, err := testSetup(t)
	defer destroyFunc()
	assert.NoError(t, err)
	storagetesting.RunTestDeleteWithSuggestionAndConflict(ctx, t, store)
}

type resourceClientMock struct {
	resource.ResourceStoreClient
	resource.ResourceIndexClient
	resource.ManagedObjectIndexClient
	resource.BulkStoreClient
	resource.BlobStoreClient
	resource.DiagnosticsClient
}

// always return GRPC Unauthenticated code
func (r resourceClientMock) List(ctx context.Context, in *resource.ListRequest, opts ...grpc.CallOption) (*resource.ListResponse, error) {
	return &resource.ListResponse{}, status.Error(codes.Unauthenticated, "missing token")
}

func TestGRPCtoHTTPStatusMapping(t *testing.T) {
	t.Run("ensure that GRPC Unauthenticated code gets translated to HTTP StatusUnauthorized", func(t *testing.T) {
		s, _, err := apistore.NewStorage(
			&storagebackend.ConfigForResource{},
			resourceClientMock{},
			nil,
			nil,
			nil,
			nil,
			nil,
			nil,
			nil,
			nil,
			apistore.StorageOptions{})
		require.NoError(t, err)

		err = s.GetList(context.Background(), "/group/resource.grafana.app/resource/resources/namespace/default", storage.ListOptions{}, nil)
		require.Error(t, err)

		var statusError *apierrors.StatusError
		ok := errors.As(err, &statusError)
		require.Equal(t, true, ok)
		require.Equal(t, int(statusError.Status().Code), http.StatusUnauthorized)
	})
}

// TODO: this test relies on update
//func TestDeleteWithSuggestionOfDeletedObject(t *testing.T) {
//	ctx, store, destroyFunc, err := testSetup(t)
//	defer destroyFunc()
//	assert.NoError(t, err)
//	storagetesting.RunTestDeleteWithSuggestionOfDeletedObject(ctx, t, store)
//}

//func TestValidateDeletionWithSuggestion(t *testing.T) {
//	ctx, store, destroyFunc, err := testSetup(t)
//	defer destroyFunc()
//	assert.NoError(t, err)
//	storagetesting.RunTestValidateDeletionWithSuggestion(ctx, t, store)
//}
//
//func TestPreconditionalDeleteWithSuggestion(t *testing.T) {
//	ctx, store, destroyFunc, err := testSetup(t)
//	defer destroyFunc()
//	assert.NoError(t, err)
//	storagetesting.RunTestPreconditionalDeleteWithSuggestion(ctx, t, store)
//}

//func TestList(t *testing.T) {
//	ctx, store, destroyFunc, err := testSetup(t)
//	defer destroyFunc()
//	assert.NoError(t, err)
//	storagetesting.RunTestList(ctx, t, store, func(ctx context.Context, t *testing.T, rv string) {
//
//	}, true)
//}

//func compact(store *Storage) storagetesting.Compaction {
//	return func(ctx context.Context, t *testing.T, resourceVersion string) {
//		// tests expect that the resource version is incremented after compaction:
//		// https://github.com/kubernetes/apiserver/blob/4f7f407e71725f4056328bbeb6d6139843716ca6/pkg/storage/etcd3/compact.go#L137
//		_ = store.getNewResourceVersion()
//	}
//}

//func TestGetListNonRecursive(t *testing.T) {
//	ctx, store, destroyFunc, err := testSetup(t)
//	defer destroyFunc()
//	assert.NoError(t, err)
//	storagetesting.RunTestGetListNonRecursive(ctx, t, compact(store.(*Storage)), store)
//}

//func checkStorageCalls(t *testing.T, pageSize, estimatedProcessedObjects uint64) {
//	if reads := getReadsAndReset(); reads != estimatedProcessedObjects {
//		t.Errorf("unexpected reads: %d, expected: %d", reads, estimatedProcessedObjects)
//	}
//	estimatedGetCalls := uint64(1)
//	if pageSize != 0 {
//		// We expect that kube-apiserver will be increasing page sizes
//		// if not full pages are received, so we should see significantly less
//		// than 1000 pages (which would be result of talking to etcd with page size
//		// copied from pred.Limit).
//		// The expected number of calls is n+1 where n is the smallest n so that:
//		// pageSize + pageSize * 2 + pageSize * 4 + ... + pageSize * 2^n >= podCount.
//		// For pageSize = 1, podCount = 1000, we get n+1 = 10, 2 ^ 10 = 1024.
//		currLimit := pageSize
//		for sum := uint64(1); sum < estimatedProcessedObjects; {
//			currLimit *= 2
//			if currLimit > 10000 {
//				currLimit = 10000
//			}
//			sum += currLimit
//			estimatedGetCalls++
//		}
//	}
//	if reads := getReadsAndReset(); reads != estimatedGetCalls {
//		t.Errorf("unexpected reads: %d, expected: %d", reads, estimatedProcessedObjects)
//	}
//}

//func TestListContinuation(t *testing.T) {
//	ctx, store, destroyFunc, err := testSetup(t)
//	defer destroyFunc()
//	assert.NoError(t, err)
//	storagetesting.RunTestListContinuation(ctx, t, store, checkStorageCalls)
//}
//
//func TestListPaginationRareObject(t *testing.T) {
//	ctx, store, destroyFunc, err := testSetup(t)
//	defer destroyFunc()
//	assert.NoError(t, err)
//	storagetesting.RunTestListPaginationRareObject(ctx, t, store, checkStorageCalls)
//}
//
//func TestListContinuationWithFilter(t *testing.T) {
//	ctx, store, destroyFunc, err := testSetup(t)
//	defer destroyFunc()
//	assert.NoError(t, err)
//	storagetesting.RunTestListContinuationWithFilter(ctx, t, store, checkStorageCalls)
//}
//
//func TestListInconsistentContinuation(t *testing.T) {
//	ctx, store, destroyFunc, err := testSetup(t)
//	defer destroyFunc()
//	assert.NoError(t, err)
//	storagetesting.RunTestListInconsistentContinuation(ctx, t, store, compact(store.(*Storage)))
//}
//
//func TestConsistentList(t *testing.T) {
//	// TODO(#109831): Enable use of this test and run it.
//}
//
//func TestGuaranteedUpdate(t *testing.T) {
//	// ctx, store, destroyFunc, err := testSetup(t)
//	// defer destroyFunc()
//	// assert.NoError(t, err)
//	// storagetesting.RunTestGuaranteedUpdate(ctx, t, store, nil)
//}
//
//func TestGuaranteedUpdateWithTTL(t *testing.T) {
//	ctx, store, destroyFunc, err := testSetup(t)
//	defer destroyFunc()
//	assert.NoError(t, err)
//	storagetesting.RunTestGuaranteedUpdateWithTTL(ctx, t, store)
//}
//
//func TestGuaranteedUpdateChecksStoredData(t *testing.T) {
//	// ctx, store, destroyFunc, err := testSetup(t)
//	// defer destroyFunc()
//	// assert.NoError(t, err)
//	// storagetesting.RunTestGuaranteedUpdateChecksStoredData(ctx, t, store)
//}
//
//func TestGuaranteedUpdateWithConflict(t *testing.T) {
//	ctx, store, destroyFunc, err := testSetup(t)
//	defer destroyFunc()
//	assert.NoError(t, err)
//	storagetesting.RunTestGuaranteedUpdateWithConflict(ctx, t, store)
//}
//
//func TestGuaranteedUpdateWithSuggestionAndConflict(t *testing.T) {
//	ctx, store, destroyFunc, err := testSetup(t)
//	defer destroyFunc()
//	assert.NoError(t, err)
//	storagetesting.RunTestGuaranteedUpdateWithSuggestionAndConflict(ctx, t, store)
//}

func TestTransformationFailure(t *testing.T) {
	// TODO(#109831): Enable use of this test and run it.
}

//func TestCount(t *testing.T) {
//	ctx, store, destroyFunc, err := testSetup(t)
//	defer destroyFunc()
//	assert.NoError(t, err)
//	storagetesting.RunTestCount(ctx, t, store)
//}
