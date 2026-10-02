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
		serializer: &jsonSerializer{},
		newFunc:    func() runtime.Object { return &unstructured.Unstructured{} },
		versioner:  &storage.APIObjectVersioner{},
		store:      client,
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

type createRetryClient struct {
	resource.ResourceClient
	attempts int
	result   func(int) (*resourcepb.CreateResponse, error)
}

func (c *createRetryClient) Create(_ context.Context, _ *resourcepb.CreateRequest, _ ...grpc.CallOption) (*resourcepb.CreateResponse, error) {
	c.attempts++
	return c.result(c.attempts)
}

func callCreate(t *testing.T, ctx context.Context, client resource.ResourceClient) (*unstructured.Unstructured, error) {
	t.Helper()
	obj := &unstructured.Unstructured{}
	require.NoError(t, obj.UnmarshalJSON(testObject(t)))
	out := &unstructured.Unstructured{}
	err := testStorage(t, client).Create(ctx, "example/test", obj, out, 0)
	return out, err
}

func TestCreateRetriesWriteConflicts(t *testing.T) {
	conflict := &resourcepb.ErrorResult{Code: http.StatusConflict, Reason: string(metav1.StatusReasonConflict), Message: "lease held"}
	conflicts := map[string]func() (*resourcepb.CreateResponse, error){
		"response conflict": func() (*resourcepb.CreateResponse, error) {
			return &resourcepb.CreateResponse{Error: conflict}, nil
		},
		"response reason-less 409": func() (*resourcepb.CreateResponse, error) {
			return &resourcepb.CreateResponse{Error: &resourcepb.ErrorResult{Code: http.StatusConflict, Message: "lease held"}}, nil
		},
		"grpc already exists with reason-less 409 details": func() (*resourcepb.CreateResponse, error) {
			return nil, grpcErrorWithResult(grpccodes.AlreadyExists, &resourcepb.ErrorResult{Code: http.StatusConflict, Message: "lease held"})
		},
		"grpc conflict with details": func() (*resourcepb.CreateResponse, error) {
			return nil, grpcErrorWithResult(grpccodes.Aborted, conflict)
		},
		"bare aborted": func() (*resourcepb.CreateResponse, error) {
			return nil, grpcstatus.Error(grpccodes.Aborted, "lease held")
		},
	}
	for name, failure := range conflicts {
		t.Run(name+"/competing create fails", func(t *testing.T) {
			// The lease holder fails without persisting an object. The next create must
			// succeed, rather than exposing the first lease conflict as AlreadyExists.
			client := &createRetryClient{result: func(attempt int) (*resourcepb.CreateResponse, error) {
				if attempt == 1 {
					return failure()
				}
				return &resourcepb.CreateResponse{ResourceVersion: 2}, nil
			}}
			out, err := callCreate(t, testContext(t), client)
			require.NoError(t, err)
			require.Equal(t, 2, client.attempts)
			require.Equal(t, "2", out.GetResourceVersion())
		})
		t.Run(name+"/exhausted", func(t *testing.T) {
			client := &createRetryClient{result: func(int) (*resourcepb.CreateResponse, error) { return failure() }}
			_, err := callCreate(t, testContext(t), client)
			require.True(t, apierrors.IsConflict(err), "expected Conflict, got %v", err)
			require.False(t, storage.IsExist(err))
			requireKubernetesError(t, err)
			require.Equal(t, createRetryConfig.MaxRetries, client.attempts)
		})
		t.Run(name+"/competing create succeeds", func(t *testing.T) {
			client := &createRetryClient{result: func(attempt int) (*resourcepb.CreateResponse, error) {
				if attempt == 1 {
					return failure()
				}
				return &resourcepb.CreateResponse{Error: &resourcepb.ErrorResult{Code: http.StatusConflict, Reason: string(metav1.StatusReasonAlreadyExists), Message: "exists"}}, nil
			}}
			_, err := callCreate(t, testContext(t), client)
			require.True(t, storage.IsExist(err), "expected KeyExistsError, got %v", err)
			require.Equal(t, 2, client.attempts)
		})
	}
}

func TestCreateConfirmedDuplicatesAreNotRetried(t *testing.T) {
	duplicate := &resourcepb.ErrorResult{Code: http.StatusConflict, Reason: string(metav1.StatusReasonAlreadyExists), Message: "exists"}
	for name, result := range map[string]func(int) (*resourcepb.CreateResponse, error){
		"response": func(int) (*resourcepb.CreateResponse, error) {
			return &resourcepb.CreateResponse{Error: duplicate}, nil
		},
		"grpc with details": func(int) (*resourcepb.CreateResponse, error) {
			return nil, grpcErrorWithResult(grpccodes.AlreadyExists, duplicate)
		},
		"bare already exists": func(int) (*resourcepb.CreateResponse, error) {
			return nil, grpcstatus.Error(grpccodes.AlreadyExists, "exists")
		},
	} {
		t.Run(name, func(t *testing.T) {
			client := &createRetryClient{result: result}
			_, err := callCreate(t, testContext(t), client)
			require.True(t, storage.IsExist(err), "expected KeyExistsError, got %v", err)
			require.Equal(t, 1, client.attempts)
		})
	}
}

func TestCreateNonConflictIsNotRetried(t *testing.T) {
	client := &createRetryClient{result: func(int) (*resourcepb.CreateResponse, error) {
		return nil, grpcstatus.Error(grpccodes.PermissionDenied, "forbidden")
	}}
	_, err := callCreate(t, testContext(t), client)
	require.True(t, apierrors.IsForbidden(err), "expected Forbidden, got %v", err)
	requireKubernetesError(t, err)
	require.Equal(t, 1, client.attempts)
}

func TestCreateConflictRetryHonorsCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(testContext(t))
	defer cancel()
	client := &createRetryClient{result: func(int) (*resourcepb.CreateResponse, error) {
		cancel()
		return nil, grpcstatus.Error(grpccodes.Aborted, "lease held")
	}}
	_, err := callCreate(t, ctx, client)
	require.ErrorIs(t, err, context.Canceled)
	require.Equal(t, 1, client.attempts)
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
	value          []byte
	conflict       func() (*resourcepb.ErrorResult, error)
	updates        int
	deletes        int
	reads          int64
	updateVersions []int64
	deleteVersions []int64
}

func (c *conflictClient) Read(context.Context, *resourcepb.ReadRequest, ...grpc.CallOption) (*resourcepb.ReadResponse, error) {
	c.reads++
	return &resourcepb.ReadResponse{Value: c.value, ResourceVersion: c.reads}, nil
}

func (c *conflictClient) Update(_ context.Context, req *resourcepb.UpdateRequest, _ ...grpc.CallOption) (*resourcepb.UpdateResponse, error) {
	c.updateVersions = append(c.updateVersions, req.ResourceVersion)
	c.updates++
	if c.updates == 1 {
		res, err := c.conflict()
		return &resourcepb.UpdateResponse{Error: res}, err
	}
	return &resourcepb.UpdateResponse{ResourceVersion: 2}, nil
}

func (c *conflictClient) Delete(_ context.Context, req *resourcepb.DeleteRequest, _ ...grpc.CallOption) (*resourcepb.DeleteResponse, error) {
	c.deleteVersions = append(c.deleteVersions, req.ResourceVersion)
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
		// Transport retries exclude Aborted; the storage retry loop must still handle
		// its detailed HTTP 409 conflict so updates and deletes can re-read before retrying.
		"grpc aborted with details": func() (*resourcepb.ErrorResult, error) {
			return nil, grpcErrorWithResult(grpccodes.Aborted, &resourcepb.ErrorResult{Code: http.StatusConflict, Message: "conflict"})
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
			require.Equal(t, []int64{1, 2}, client.updateVersions, "the retry must use the freshly read resource version")
		})

		t.Run(name+"/Delete", func(t *testing.T) {
			client := &conflictClient{value: testObject(t), conflict: conflict}
			s := testStorage(t, client)

			err := s.Delete(testContext(t), "example/test", &unstructured.Unstructured{}, nil, nil, nil, storage.DeleteOptions{})
			require.NoError(t, err)
			require.Equal(t, 2, client.deletes, "the conflict must be retried")
			require.Equal(t, []int64{1, 2}, client.deleteVersions, "the retry must use the freshly read resource version")
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
