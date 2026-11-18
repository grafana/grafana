package interceptors

import (
	"net/http"
	"testing"

	"github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/logging"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
)

func TestServerCodeToLevel(t *testing.T) {
	require.Equal(t, logging.LevelWarn, serverCodeToLevel(codes.Code(http.StatusGone)), "an expired watch is not a server error")
	require.Equal(t, logging.LevelWarn, serverCodeToLevel(codes.OutOfRange))
	require.Equal(t, logging.LevelError, serverCodeToLevel(codes.Code(http.StatusInternalServerError)))
	require.Equal(t, logging.LevelError, serverCodeToLevel(codes.Internal))
	require.Equal(t, logging.LevelInfo, serverCodeToLevel(codes.OK))
}
