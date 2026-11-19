package unified

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestUnaryRetryInterceptorCodes(t *testing.T) {
	for _, code := range []codes.Code{codes.Aborted, codes.Unavailable, codes.ResourceExhausted, codes.InvalidArgument} {
		t.Run(code.String(), func(t *testing.T) {
			st, err := status.New(code, "failure").WithDetails(&resourcepb.ErrorResult{Code: http.StatusConflict, Message: "conflict"})
			require.NoError(t, err)
			failure := st.Err()
			attempts := 0
			invoker := func(context.Context, string, interface{}, interface{}, *grpc.ClientConn, ...grpc.CallOption) error {
				attempts++
				if attempts == 1 {
					return failure
				}
				return nil
			}
			interceptor := unaryRetryInterceptor(retryConfig{Max: 3})
			err = interceptor(t.Context(), "/test/Update", nil, nil, nil, invoker)
			if code == codes.Unavailable || code == codes.ResourceExhausted {
				require.NoError(t, err)
				require.Equal(t, 2, attempts)
			} else {
				require.Equal(t, 1, attempts)
				require.Equal(t, st.Proto(), status.Convert(err).Proto())
			}
		})
	}
}
