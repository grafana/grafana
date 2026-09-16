package apistore

import (
	"bytes"
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	grpccodes "google.golang.org/grpc/codes"
	grpcstatus "google.golang.org/grpc/status"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/storage"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// grpcErrorWithResult builds the error shape a newer unified storage server returns: a gRPC
// status carrying the detailed ErrorResult, with no response message.
func grpcErrorWithResult(code grpccodes.Code, res *resourcepb.ErrorResult) error {
	st := grpcstatus.New(code, res.Message)
	if withDetails, err := st.WithDetails(res); err == nil {
		st = withDetails
	}
	return st.Err()
}

func testStorage(t *testing.T, client resource.ResourceClient) *Storage {
	t.Helper()
	return &Storage{
		codec:     unstructured.UnstructuredJSONScheme,
		newFunc:   func() runtime.Object { return &unstructured.Unstructured{} },
		versioner: &storage.APIObjectVersioner{},
		store:     client,
		getKey: func(string) (*resourcepb.ResourceKey, error) {
			return &resourcepb.ResourceKey{Namespace: "default", Group: "example.grafana.app", Resource: "examples", Name: "test"}, nil
		},
	}
}

func testContext(t *testing.T) context.Context {
	requester := &identity.StaticRequester{Type: claims.TypeUser, UserID: 1, OrgRole: identity.RoleAdmin, IsGrafanaAdmin: true}
	return identity.WithRequester(t.Context(), requester)
}

func testObject(t *testing.T) []byte {
	t.Helper()
	obj := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "example.grafana.app/v1",
		"kind":       "Example",
		"metadata": map[string]any{
			"namespace": "default",
			"name":      "test",
			"uid":       "u1",
		},
	}}
	var raw bytes.Buffer
	require.NoError(t, unstructured.UnstructuredJSONScheme.Encode(obj, &raw))
	return raw.Bytes()
}

// notFoundReadClient reports NotFound the way the newer server does: as a gRPC error with no
// ReadResponse at all.
type notFoundReadClient struct {
	resource.ResourceClient
	readErr error
	created int
}

func (c *notFoundReadClient) Read(context.Context, *resourcepb.ReadRequest, ...grpc.CallOption) (*resourcepb.ReadResponse, error) {
	return nil, c.readErr
}

func (c *notFoundReadClient) Create(context.Context, *resourcepb.CreateRequest, ...grpc.CallOption) (*resourcepb.CreateResponse, error) {
	c.created++
	return &resourcepb.CreateResponse{ResourceVersion: 1}, nil
}

func TestGuaranteedUpdateNotFoundAsGRPCError(t *testing.T) {
	notFound := grpcErrorWithResult(grpccodes.NotFound, &resourcepb.ErrorResult{Code: http.StatusNotFound, Message: "not found"})

	tryUpdate := func(runtime.Object, storage.ResponseMeta) (runtime.Object, *uint64, error) {
		return &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "example.grafana.app/v1",
			"kind":       "Example",
			"metadata":   map[string]any{"namespace": "default", "name": "test"},
		}}, nil, nil
	}

	t.Run("ignoreNotFound upserts instead of dereferencing the missing response", func(t *testing.T) {
		client := &notFoundReadClient{readErr: notFound}
		s := testStorage(t, client)

		err := s.GuaranteedUpdate(testContext(t), "example/test", &unstructured.Unstructured{}, true, nil, tryUpdate, nil)
		require.NoError(t, err)
		require.Equal(t, 1, client.created)
	})

	t.Run("without ignoreNotFound returns NotFound", func(t *testing.T) {
		client := &notFoundReadClient{readErr: notFound}
		s := testStorage(t, client)

		err := s.GuaranteedUpdate(testContext(t), "example/test", &unstructured.Unstructured{}, false, nil, tryUpdate, nil)
		require.True(t, apierrors.IsNotFound(err), "expected NotFound, got: %v", err)
		require.Equal(t, 0, client.created)
	})
}

// conflictClient fails the first update or delete with a conflict, then succeeds, so a test can
// assert the retry loop classified the conflict.
type conflictClient struct {
	resource.ResourceClient
	value    []byte
	conflict func() (*resourcepb.ErrorResult, error)
	updates  int
	deletes  int
}

func (c *conflictClient) Read(context.Context, *resourcepb.ReadRequest, ...grpc.CallOption) (*resourcepb.ReadResponse, error) {
	return &resourcepb.ReadResponse{Value: c.value, ResourceVersion: 1}, nil
}

func (c *conflictClient) Update(context.Context, *resourcepb.UpdateRequest, ...grpc.CallOption) (*resourcepb.UpdateResponse, error) {
	c.updates++
	if c.updates == 1 {
		res, err := c.conflict()
		return &resourcepb.UpdateResponse{Error: res}, err
	}
	return &resourcepb.UpdateResponse{ResourceVersion: 2}, nil
}

func (c *conflictClient) Delete(context.Context, *resourcepb.DeleteRequest, ...grpc.CallOption) (*resourcepb.DeleteResponse, error) {
	c.deletes++
	if c.deletes == 1 {
		res, err := c.conflict()
		return &resourcepb.DeleteResponse{Error: res}, err
	}
	return &resourcepb.DeleteResponse{ResourceVersion: 2}, nil
}

func TestRetriesConflictFromBothErrorShapes(t *testing.T) {
	conflicts := map[string]func() (*resourcepb.ErrorResult, error){
		"response error": func() (*resourcepb.ErrorResult, error) {
			return &resourcepb.ErrorResult{Code: http.StatusConflict, Message: "conflict"}, nil
		},
		"grpc status with details": func() (*resourcepb.ErrorResult, error) {
			return nil, grpcErrorWithResult(grpccodes.AlreadyExists, &resourcepb.ErrorResult{Code: http.StatusConflict, Message: "conflict"})
		},
	}

	for name, conflict := range conflicts {
		t.Run(name+"/GuaranteedUpdate", func(t *testing.T) {
			client := &conflictClient{value: testObject(t), conflict: conflict}
			s := testStorage(t, client)

			tryUpdate := func(in runtime.Object, _ storage.ResponseMeta) (runtime.Object, *uint64, error) {
				return in.(*unstructured.Unstructured).DeepCopy(), nil, nil
			}

			err := s.GuaranteedUpdate(testContext(t), "example/test", &unstructured.Unstructured{}, false, &storage.Preconditions{}, tryUpdate, nil)
			require.NoError(t, err)
			require.Equal(t, 2, client.updates, "the conflict must be retried")
		})

		t.Run(name+"/Delete", func(t *testing.T) {
			client := &conflictClient{value: testObject(t), conflict: conflict}
			s := testStorage(t, client)

			err := s.Delete(testContext(t), "example/test", &unstructured.Unstructured{}, nil, nil, nil, storage.DeleteOptions{})
			require.NoError(t, err)
			require.Equal(t, 2, client.deletes, "the conflict must be retried")
		})
	}
}

// alwaysFailsClient returns the same failure on every attempt, so a test can drive the retry
// budget to exhaustion or assert a non-retryable error is returned immediately.
type alwaysFailsClient struct {
	resource.ResourceClient
	value   []byte
	err     error
	updates int
	deletes int
}

func (c *alwaysFailsClient) Read(context.Context, *resourcepb.ReadRequest, ...grpc.CallOption) (*resourcepb.ReadResponse, error) {
	return &resourcepb.ReadResponse{Value: c.value, ResourceVersion: 1}, nil
}

func (c *alwaysFailsClient) Update(context.Context, *resourcepb.UpdateRequest, ...grpc.CallOption) (*resourcepb.UpdateResponse, error) {
	c.updates++
	return nil, c.err
}

func (c *alwaysFailsClient) Delete(context.Context, *resourcepb.DeleteRequest, ...grpc.CallOption) (*resourcepb.DeleteResponse, error) {
	c.deletes++
	return nil, c.err
}

// requireKubernetesError asserts the storage boundary converted the error to a Kubernetes status
// error rather than leaking the raw transport error.
func requireKubernetesError(t *testing.T, err error) {
	t.Helper()
	require.Error(t, err)
	var apistatus apierrors.APIStatus
	require.ErrorAs(t, err, &apistatus, "expected a Kubernetes status error, got %T: %v", err, err)
	_, isGRPC := grpcstatus.FromError(err)
	require.False(t, isGRPC, "raw gRPC status leaked out of the storage boundary: %v", err)
}

func TestNonRetryableGRPCErrorIsConverted(t *testing.T) {
	forbidden := grpcErrorWithResult(grpccodes.PermissionDenied, &resourcepb.ErrorResult{
		Code:    http.StatusForbidden,
		Reason:  string(metav1.StatusReasonForbidden),
		Message: "forbidden",
	})

	t.Run("GuaranteedUpdate", func(t *testing.T) {
		client := &alwaysFailsClient{value: testObject(t), err: forbidden}
		s := testStorage(t, client)

		tryUpdate := func(in runtime.Object, _ storage.ResponseMeta) (runtime.Object, *uint64, error) {
			return in.(*unstructured.Unstructured).DeepCopy(), nil, nil
		}

		err := s.GuaranteedUpdate(testContext(t), "example/test", &unstructured.Unstructured{}, false, &storage.Preconditions{}, tryUpdate, nil)
		require.True(t, apierrors.IsForbidden(err), "expected Forbidden, got: %v", err)
		requireKubernetesError(t, err)
		require.Equal(t, 1, client.updates, "a non-retryable error must not be retried")
	})

	t.Run("Delete", func(t *testing.T) {
		client := &alwaysFailsClient{value: testObject(t), err: forbidden}
		s := testStorage(t, client)

		err := s.Delete(testContext(t), "example/test", &unstructured.Unstructured{}, nil, nil, nil, storage.DeleteOptions{})
		require.True(t, apierrors.IsForbidden(err), "expected Forbidden, got: %v", err)
		requireKubernetesError(t, err)
		require.Equal(t, 1, client.deletes, "a non-retryable error must not be retried")
	})
}

func TestExhaustedConflictRetriesReturnKubernetesError(t *testing.T) {
	conflict := grpcErrorWithResult(grpccodes.AlreadyExists, &resourcepb.ErrorResult{
		Code:    http.StatusConflict,
		Reason:  string(metav1.StatusReasonConflict),
		Message: "conflict",
	})

	t.Run("GuaranteedUpdate", func(t *testing.T) {
		client := &alwaysFailsClient{value: testObject(t), err: conflict}
		s := testStorage(t, client)

		tryUpdate := func(in runtime.Object, _ storage.ResponseMeta) (runtime.Object, *uint64, error) {
			return in.(*unstructured.Unstructured).DeepCopy(), nil, nil
		}

		err := s.GuaranteedUpdate(testContext(t), "example/test", &unstructured.Unstructured{}, false, &storage.Preconditions{}, tryUpdate, nil)
		require.True(t, apierrors.IsConflict(err), "expected Conflict, got: %v", err)
		requireKubernetesError(t, err)
		require.Greater(t, client.updates, 1, "the conflict must be retried before giving up")
	})

	t.Run("Delete", func(t *testing.T) {
		client := &alwaysFailsClient{value: testObject(t), err: conflict}
		s := testStorage(t, client)

		err := s.Delete(testContext(t), "example/test", &unstructured.Unstructured{}, nil, nil, nil, storage.DeleteOptions{})
		require.True(t, apierrors.IsConflict(err), "expected Conflict, got: %v", err)
		requireKubernetesError(t, err)
		require.Greater(t, client.deletes, 1, "the conflict must be retried before giving up")
	})
}
