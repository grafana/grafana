package folders

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/endpoints/handlers/responsewriters"

	folderv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestSubChildren_ErrorStatus(t *testing.T) {
	failure := &resourcepb.ErrorResult{
		Code:    http.StatusTooManyRequests,
		Reason:  string(metav1.StatusReasonTooManyRequests),
		Message: "search is busy",
		Details: &resourcepb.ErrorDetails{RetryAfterSeconds: 12},
	}
	grpcStatus, err := status.New(codes.ResourceExhausted, "search is busy").WithDetails(failure)
	require.NoError(t, err)

	tests := []struct {
		name     string
		response *resourcepb.ResourceSearchResponse
		err      error
	}{
		{
			name:     "embedded ErrorResult",
			response: &resourcepb.ResourceSearchResponse{Error: failure},
		},
		{
			name: "wrapped gRPC error with ErrorResult details",
			err:  fmt.Errorf("search: %w", grpcStatus.Err()),
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			search := &capturingSearchClient{resp: tc.response, err: tc.err}
			getter := &stubGetter{obj: &folderv1.Folder{ObjectMeta: metav1.ObjectMeta{Name: "parent"}}}
			rest := &subChildrenREST{getter: getter, searcher: search}
			responder := &recordingResponder{}

			handler, err := rest.Connect(newChildrenCtx(), "parent", nil, responder)
			require.NoError(t, err)
			handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest("GET", "/parent/children", nil))

			// ErrorToAPIStatus does not unwrap errors, so ErrorAs alone is insufficient.
			require.IsType(t, &apierrors.StatusError{}, responder.err)
			got := responsewriters.ErrorToAPIStatus(responder.err)
			require.Equal(t, &metav1.Status{
				TypeMeta: metav1.TypeMeta{Kind: "Status", APIVersion: "v1"},
				Status:   metav1.StatusFailure,
				Code:     http.StatusTooManyRequests,
				Reason:   metav1.StatusReasonTooManyRequests,
				Message:  "search is busy",
				Details:  &metav1.StatusDetails{RetryAfterSeconds: 12},
			}, got)
		})
	}
}
