package webhooks

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
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/handlers/responsewriters"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type renderErrorResponder struct {
	err error
}

func (r *renderErrorResponder) Error(err error) {
	r.err = err
}

func (r *renderErrorResponder) Object(int, runtime.Object) {}

func TestRenderErrorStatus(t *testing.T) {
	failure := &resourcepb.ErrorResult{
		Code: http.StatusNotFound, Reason: string(metav1.StatusReasonNotFound), Message: "render not found",
		Details: &resourcepb.ErrorDetails{Name: "repo", Group: "provisioning.grafana.app", Kind: "repositories", Uid: "uid"},
	}
	st, err := status.New(codes.NotFound, "render not found").WithDetails(failure)
	require.NoError(t, err)
	for name, input := range map[string]struct {
		resp *resourcepb.GetBlobResponse
		err  error
	}{
		"embedded":  {resp: &resourcepb.GetBlobResponse{Error: failure}},
		"transport": {err: fmt.Errorf("get blob: %w", st.Err())},
	} {
		t.Run(name, func(t *testing.T) {
			client := resource.NewMockResourceClient(t)
			client.EXPECT().GetBlob(mock.Anything, mock.Anything).Return(input.resp, input.err).Once()
			connector := NewRenderConnector(client, nil)
			responder := &renderErrorResponder{}
			ctx := request.WithNamespace(context.Background(), "default")
			handler, err := connector.Connect(ctx, "repo", nil, responder)
			require.NoError(t, err)
			handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest("GET", "/repo/render/123e4567-e89b-12d3-a456-426614174000", nil))
			require.Error(t, responder.err)
			require.Equal(t, responsewriters.ErrorToAPIStatus(resource.GetError(failure)), responsewriters.ErrorToAPIStatus(responder.err))
		})
	}
}
