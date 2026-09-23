package folderownership

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/endpoints/handlers/responsewriters"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestValidateNoOwnedFoldersErrorStatus(t *testing.T) {
	failure := &resourcepb.ErrorResult{
		Code: http.StatusServiceUnavailable, Reason: string(metav1.StatusReasonServiceUnavailable), Message: "search unavailable",
		Details: &resourcepb.ErrorDetails{Name: "folder", Group: "folder.grafana.app", Kind: "folders", Uid: "uid"},
	}
	st, err := status.New(codes.Unavailable, "search unavailable").WithDetails(failure)
	require.NoError(t, err)
	for name, input := range map[string]struct {
		resp *resourcepb.ResourceSearchResponse
		err  error
	}{
		"embedded":  {resp: &resourcepb.ResourceSearchResponse{Error: failure}},
		"transport": {err: fmt.Errorf("search: %w", st.Err())},
	} {
		t.Run(name, func(t *testing.T) {
			client := resource.NewMockResourceClient(t)
			client.EXPECT().Search(mock.Anything, mock.Anything).Return(input.resp, input.err).Once()
			err := ValidateNoOwnedFolders(context.Background(), client, "default", "team")
			require.Error(t, err)
			require.Equal(t, responsewriters.ErrorToAPIStatus(resource.GetError(failure)), responsewriters.ErrorToAPIStatus(err))
		})
	}
}
