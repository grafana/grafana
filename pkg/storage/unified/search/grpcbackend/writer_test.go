package grpcbackend

import (
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/enginepb"
)

func TestIndexWriterRejectsAmbiguousOrMismatchedScope(t *testing.T) {
	key := &resourcepb.ResourceKey{Namespace: "default", Group: "dashboard.grafana.app", Resource: "dashboards", Name: "test"}
	for _, tc := range []struct {
		name   string
		change func(*enginepb.IndexScope, *resourcepb.ResourceKey)
	}{
		{"missing index", func(scope *enginepb.IndexScope, _ *resourcepb.ResourceKey) { scope.Indexes = nil }},
		{"missing generation", func(scope *enginepb.IndexScope, _ *resourcepb.ResourceKey) { scope.Indexes[0].Generation = "" }},
		{"two generations", func(scope *enginepb.IndexScope, _ *resourcepb.ResourceKey) {
			next := proto.CloneOf(scope.Indexes[0])
			next.Generation = "next"
			scope.Indexes = append(scope.Indexes, next)
		}},
		{"other namespace", func(_ *enginepb.IndexScope, key *resourcepb.ResourceKey) { key.Namespace = "other" }},
		{"other group", func(_ *enginepb.IndexScope, key *resourcepb.ResourceKey) { key.Group = "other" }},
		{"other resource", func(_ *enginepb.IndexScope, key *resourcepb.ResourceKey) { key.Resource = "other" }},
	} {
		t.Run(tc.name, func(t *testing.T) {
			scope := grpcTestScope(resource.NamespacedResource{Namespace: key.Namespace, Group: key.Group, Resource: key.Resource})
			target := proto.CloneOf(key)
			tc.change(scope, target)
			// Invalid requests must not reach the client.
			writer := IndexWriter{Scope: scope}
			err := writer.Write(t.Context(), []*resource.BulkIndexItem{{Action: resource.ActionDelete, Key: target}})
			require.Equal(t, codes.InvalidArgument, status.Code(err))
		})
	}
}
