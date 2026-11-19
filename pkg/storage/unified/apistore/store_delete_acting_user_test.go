package apistore

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	grpccodes "google.golang.org/grpc/codes"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apiserver/pkg/storage"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/storage/unified/resourceclient"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type deleteCapturingClient struct {
	resourceclient.ResourceClient
	value    []byte
	captured *resourcepb.DeleteRequest
	// requests records every delete attempt, including ones that fail.
	requests []*resourcepb.DeleteRequest
	// failFirst, when set, fails the first attempt so the retry loop runs again.
	failFirst error
}

func (c *deleteCapturingClient) Read(context.Context, *resourcepb.ReadRequest, ...grpc.CallOption) (*resourcepb.ReadResponse, error) {
	return &resourcepb.ReadResponse{Value: c.value, ResourceVersion: 1}, nil
}

func (c *deleteCapturingClient) Delete(_ context.Context, req *resourcepb.DeleteRequest, _ ...grpc.CallOption) (*resourcepb.DeleteResponse, error) {
	c.captured = req
	c.requests = append(c.requests, req)
	if c.failFirst != nil && len(c.requests) == 1 {
		return nil, c.failFirst
	}
	return &resourcepb.DeleteResponse{ResourceVersion: 2}, nil
}

func TestDeleteForwardsActingUser(t *testing.T) {
	t.Run("metadata identity is sent as the acting user", func(t *testing.T) {
		client := &deleteCapturingClient{value: testObject(t)}
		ctx := identity.WithOriginalIdentityUID(testContext(t), "user:alice")

		err := testStorage(t, client).Delete(ctx, "example/test", &unstructured.Unstructured{}, nil, nil, nil, storage.DeleteOptions{})
		require.NoError(t, err)
		require.Equal(t, "user:alice", client.captured.ActingUserUid)
	})

	t.Run("the acting user is sent again when a conflict retries the delete", func(t *testing.T) {
		client := &deleteCapturingClient{
			value:     testObject(t),
			failFirst: grpcErrorWithResult(grpccodes.Aborted, &resourcepb.ErrorResult{Code: http.StatusConflict, Message: "conflict"}),
		}
		ctx := identity.WithOriginalIdentityUID(testContext(t), "user:alice")

		err := testStorage(t, client).Delete(ctx, "example/test", &unstructured.Unstructured{}, nil, nil, nil, storage.DeleteOptions{})
		require.NoError(t, err)
		require.Len(t, client.requests, 2, "the conflict must be retried")
		for i, req := range client.requests {
			require.Equal(t, "user:alice", req.ActingUserUid, "attempt %d", i+1)
		}
	})

	t.Run("no metadata identity leaves the acting user empty", func(t *testing.T) {
		client := &deleteCapturingClient{value: testObject(t)}

		err := testStorage(t, client).Delete(testContext(t), "example/test", &unstructured.Unstructured{}, nil, nil, nil, storage.DeleteOptions{})
		require.NoError(t, err)
		require.Empty(t, client.captured.ActingUserUid)
	})
}
