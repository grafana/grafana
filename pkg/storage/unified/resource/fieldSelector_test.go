package resource

import (
	"context"
	"net/http"
	"testing"

	authlib "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/proto"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type internalReadBackend struct {
	StorageBackend
	failure *resourcepb.ErrorResult
}

func (b *internalReadBackend) ReadResource(context.Context, *resourcepb.ReadRequest) *BackendReadResponse {
	return &BackendReadResponse{Error: b.failure}
}

func TestTryFieldSelectorReadErrors(t *testing.T) {
	for _, code := range []int32{http.StatusNotFound, http.StatusForbidden} {
		t.Run(http.StatusText(int(code)), func(t *testing.T) {
			failure := &resourcepb.ErrorResult{Code: code, Message: "read failed"}
			srv, err := NewUninitializedResourceServer(ResourceServerOptions{Backend: &internalReadBackend{failure: failure}})
			require.NoError(t, err)
			t.Cleanup(srv.cancel)
			resp := srv.tryFieldSelector(authlib.WithAuthInfo(t.Context(), newWatchTestUser()), &resourcepb.ListRequest{
				Source: resourcepb.ListRequest_STORE,
				Options: &resourcepb.ListOptions{
					Key:    bookmarkWatchRequest().Options.Key,
					Fields: []*resourcepb.Requirement{{Key: "metadata.name", Operator: "=", Values: []string{"missing"}}},
				},
			})
			require.Empty(t, resp.Items)
			if code == http.StatusNotFound {
				require.Nil(t, resp.Error)
			} else {
				require.True(t, proto.Equal(failure, resp.Error))
			}
		})
	}
}
