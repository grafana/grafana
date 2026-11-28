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
		"nil response":     nil,
		"empty response":   {},
		"partial response": {Processed: 3},
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

func TestFilterResponseKeepsRejectedItems(t *testing.T) {
	gr := dummyGR()
	kept := &resourcepb.BulkResponse_Rejected{
		Key:   &resourcepb.ResourceKey{Namespace: "default", Group: gr.Group, Resource: gr.Resource, Name: "bad"},
		Error: "invalid spec",
	}
	other := &resourcepb.BulkResponse_Rejected{
		Key:   &resourcepb.ResourceKey{Namespace: "default", Group: "other.group", Resource: "others", Name: "bad"},
		Error: "other failure",
	}
	filtered := filterResponse(&resourcepb.BulkResponse{
		Processed: 5,
		Summary:   []*resourcepb.BulkResponse_Summary{{Group: gr.Group, Resource: gr.Resource, Count: 4}, {Group: "other.group", Resource: "others", Count: 1}},
		Rejected:  []*resourcepb.BulkResponse_Rejected{kept, other, {Error: "no key"}},
	}, []schema.GroupResource{gr})

	require.Equal(t, int64(5), filtered.Processed)
	require.Len(t, filtered.Summary, 1)
	require.Equal(t, []*resourcepb.BulkResponse_Rejected{kept}, filtered.Rejected)
	require.Equal(t, "invalid spec", filtered.Rejected[0].Error)
}
