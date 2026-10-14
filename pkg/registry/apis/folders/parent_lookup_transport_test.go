package folders

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/handlers/responsewriters"
	"k8s.io/apiserver/pkg/registry/rest"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestCreateParentLookupTransportStatuses(t *testing.T) {
	for _, tc := range []struct {
		name     string
		grpcCode codes.Code
		httpCode int32
		reason   metav1.StatusReason
	}{
		{"throttled", codes.ResourceExhausted, http.StatusTooManyRequests, metav1.StatusReasonTooManyRequests},
		{"unavailable", codes.Unavailable, http.StatusServiceUnavailable, metav1.StatusReasonServiceUnavailable},
		{"timeout", codes.DeadlineExceeded, http.StatusGatewayTimeout, metav1.StatusReasonTimeout},
	} {
		for _, encoding := range []string{"grpc", "grpc with details", "wrapped grpc with details", "response error"} {
			failure := &resourcepb.ErrorResult{
				Code:    tc.httpCode,
				Reason:  string(tc.reason),
				Message: "parent lookup failed",
				Details: &resourcepb.ErrorDetails{
					Group:             "folder.grafana.app",
					Kind:              "folders",
					Name:              "ancestor",
					RetryAfterSeconds: 7,
				},
			}
			var lookupErr error
			switch encoding {
			case "grpc":
				lookupErr = status.Error(tc.grpcCode, "private transport details")
			case "grpc with details", "wrapped grpc with details":
				st, err := status.New(tc.grpcCode, "private transport details").WithDetails(failure)
				require.NoError(t, err)
				lookupErr = st.Err()
				if encoding == "wrapped grpc with details" {
					lookupErr = fmt.Errorf("read failed: %w", lookupErr)
				}
			case "response error":
				lookupErr = resource.ErrorFromResponse(failure, nil)
			}
			for _, ancestor := range []bool{false, true} {
				for _, dryRun := range []bool{false, true} {
					for _, wrappedStorage := range []bool{false, true} {
						t.Run(fmt.Sprintf("%s/%s/ancestor=%t/dryRun=%t/wrappedStorage=%t", tc.name, encoding, ancestor, dryRun, wrappedStorage), func(t *testing.T) {
							store := grafanarest.NewMockStorage(t)
							parent := "ancestor"
							if ancestor {
								parent = "parent"
								store.On("Get", mock.Anything, parent, &metav1.GetOptions{}).
									Return(folderWithParent(parent, "ancestor"), nil).Once()
							}
							store.On("Get", mock.Anything, "ancestor", &metav1.GetOptions{}).Return(nil, lookupErr).Once()
							obj := folderWithParent("child", parent)
							validation := func(ctx context.Context, obj runtime.Object) error {
								return validateOnCreate(ctx, obj.(*folders.Folder), newParentsGetter(store, 5), 5, dryRun)
							}
							var err error
							if wrappedStorage {
								store.On("Create", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
									Return(func(ctx context.Context, obj runtime.Object, validate rest.ValidateObjectFunc, _ *metav1.CreateOptions) (runtime.Object, error) {
										return nil, fmt.Errorf("create failed: %w", validate(ctx, obj))
									}).Once()
								storage := folderStorage{store: store}
								options := &metav1.CreateOptions{}
								if dryRun {
									options.DryRun = []string{metav1.DryRunAll}
								}
								_, err = storage.Create(context.Background(), obj, validation, options)
							} else {
								err = validation(context.Background(), obj)
							}
							require.IsType(t, &apierrors.StatusError{}, err)
							apiStatus := responsewriters.ErrorToAPIStatus(err)
							require.Equal(t, tc.httpCode, apiStatus.Code)
							if encoding == "grpc" {
								require.Nil(t, apiStatus.Details)
								if tc.httpCode >= http.StatusInternalServerError {
									require.Equal(t, http.StatusText(int(tc.httpCode)), apiStatus.Message)
									require.NotContains(t, apiStatus.Message, "private transport details")
								}
							} else {
								require.Equal(t, tc.reason, apiStatus.Reason)
								require.Equal(t, failure.Message, apiStatus.Message)
								require.Equal(t, &metav1.StatusDetails{
									Group:             failure.Details.Group,
									Kind:              failure.Details.Kind,
									Name:              failure.Details.Name,
									RetryAfterSeconds: 7,
								}, apiStatus.Details)
							}
						})
					}
				}
			}
		}
	}
}
