package test

import (
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/storage/unified/resourceclient/resourceutil"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// requireRPCErrorResult asserts that err is the gRPC status a unified storage
// server returns for a failed call, carrying an ErrorResult detail, and
// returns the detail.
func requireRPCErrorResult(t testing.TB, err error) *resourcepb.ErrorResult {
	t.Helper()
	require.Error(t, err)
	_, ok := status.FromError(err)
	require.True(t, ok, "expected a gRPC status error, got %T: %v", err, err)
	res := resourceutil.ErrorResultFromGRPCDetails(err)
	require.NotNil(t, res, "expected an ErrorResult detail on %v", err)
	return res
}
