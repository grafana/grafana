package migrations

import (
	"net/http"
	"testing"

	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestMigrateOrgStatusError(t *testing.T) {
	result := &resourcepb.ErrorResult{Code: http.StatusForbidden, Reason: "Forbidden", Message: "bulk import denied"}
	st, err := status.New(codes.PermissionDenied, result.Message).WithDetails(result)
	require.NoError(t, err)

	for name, response := range map[string]*resourcepb.BulkResponse{
		"nil response":   nil,
		"empty response": {},
	} {
		t.Run(name, func(t *testing.T) {
			fake := &fakeUnifiedMigrator{migrateResponse: response, migrateErr: st.Err()}
			runner := NewMigrationRunner(fake, noopLocker(), nil, setting.NewCfg(), testDef(dummyGR(), nil, nil), nil)

			got, err := runner.MigrateOrg(t.Context(), nil, nil, types.NamespaceInfo{OrgID: 1, Value: "default"}, RunOptions{})
			require.Nil(t, got)
			require.ErrorContains(t, err, "migration failed for org 1 (default)")
			require.True(t, proto.Equal(result, resource.AsErrorResult(err)), "status details must survive wrapping")
			require.Equal(t, 1, fake.migrateCalled)
			require.Zero(t, fake.rebuildCalled, "indexes must not be rebuilt after a failed migration")
		})
	}
}

// BulkProcess is client-streaming and has no conversion interceptor, so the
// server still reports bulk failures only in the response body.
func TestMigrateOrgEmbeddedBulkError(t *testing.T) {
	result := &resourcepb.ErrorResult{Code: http.StatusPreconditionFailed, Message: "bulk lock held"}
	fake := &fakeUnifiedMigrator{migrateResponse: &resourcepb.BulkResponse{Error: result}}
	runner := NewMigrationRunner(fake, noopLocker(), nil, setting.NewCfg(), testDef(dummyGR(), nil, nil), nil)

	got, err := runner.MigrateOrg(t.Context(), nil, nil, types.NamespaceInfo{OrgID: 1, Value: "default"}, RunOptions{})
	require.Nil(t, got)
	require.ErrorContains(t, err, "bulk lock held")
	require.Equal(t, int32(http.StatusPreconditionFailed), resource.AsErrorResult(err).Code)
	require.Zero(t, fake.rebuildCalled, "indexes must not be rebuilt after a failed migration")
}

func TestFilterResponseKeepsBulkError(t *testing.T) {
	result := &resourcepb.ErrorResult{Code: http.StatusInternalServerError, Message: "bulk failed"}
	filtered := filterResponse(&resourcepb.BulkResponse{Error: result}, []schema.GroupResource{dummyGR()})
	require.True(t, proto.Equal(result, filtered.GetError()))
}
