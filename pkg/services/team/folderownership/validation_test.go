package folderownership

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestValidateNoOwnedFoldersErrorStatus(t *testing.T) {
	for name, input := range map[string]struct {
		resp *resourcepb.ResourceSearchResponse
		err  error
	}{
		"embedded": {resp: &resourcepb.ResourceSearchResponse{Error: &resourcepb.ErrorResult{
			Code: http.StatusServiceUnavailable, Message: "search unavailable",
		}}},
		"transport": {err: fmt.Errorf("search: %w", status.Error(codes.Unavailable, "search unavailable"))},
	} {
		t.Run(name, func(t *testing.T) {
			client := resource.NewMockResourceClient(t)
			client.EXPECT().Search(mock.Anything, mock.Anything).Return(input.resp, input.err).Once()
			err := ValidateNoOwnedFolders(t.Context(), client, "default", "team")
			require.True(t, apierrors.IsServiceUnavailable(err), "got %v", err)
		})
	}
}
