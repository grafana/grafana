package grpcbackend

import (
	"strings"
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
			writer := IndexWriter{Scope: scope}
			req, err := writer.PrepareBatches([]*resource.BulkIndexItem{{Action: resource.ActionDelete, Key: target}})
			require.Equal(t, codes.InvalidArgument, status.Code(err))
			require.Nil(t, req)
		})
	}
}

func TestIndexWriterLimitsSerializedBatchSize(t *testing.T) {
	key := resource.NamespacedResource{Namespace: "default", Group: "dashboard.grafana.app", Resource: "dashboards"}
	writer := IndexWriter{Scope: grpcTestScope(key)}
	item := func(name, body string) *resource.BulkIndexItem {
		return &resource.BulkIndexItem{Action: resource.ActionIndex, Doc: &resource.IndexableDocument{
			Key: &resourcepb.ResourceKey{Namespace: key.Namespace, Group: key.Group, Resource: key.Resource, Name: name}, Description: body,
		}}
	}
	body := strings.Repeat("x", 2<<20)
	items := []*resource.BulkIndexItem{item("one", body), item("two", body)}
	batches, err := writer.PrepareBatches(items)
	require.NoError(t, err)
	require.Len(t, batches, 2)
	for n, batch := range batches {
		require.LessOrEqual(t, proto.Size(batch), 4<<20)
		require.Len(t, batch.Writes, 1)
		require.Equal(t, items[n].Doc.Key.Name, batch.Writes[0].Key.Name)
	}

	batches, err = writer.PrepareBatches(append(items, item("oversized", strings.Repeat("x", 4<<20))))
	require.Equal(t, codes.ResourceExhausted, status.Code(err))
	require.Nil(t, batches)
}
