package annotation

import (
	"context"
	"net"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"
	"google.golang.org/grpc/test/bufconn"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	annotationV0 "github.com/grafana/grafana/apps/annotation/pkg/apis/annotation/v0alpha1"
	storev1 "github.com/grafana/grafana/pkg/registry/apps/annotation/storepb/v1"
)

// mockGRPCServer implements the gRPC AnnotationStore service for testing
type mockGRPCServer struct {
	store       Store
	tagProvider TagProvider
	lifecycle   LifecycleManager
	storev1.UnimplementedAnnotationStoreServer
}

var _ storev1.AnnotationStoreServer = (*mockGRPCServer)(nil)

func newMockGRPCServer(store Store) *mockGRPCServer {
	server := &mockGRPCServer{
		store: store,
	}

	if tp, ok := store.(TagProvider); ok {
		server.tagProvider = tp
	}
	if lm, ok := store.(LifecycleManager); ok {
		server.lifecycle = lm
	}

	return server
}

func (s *mockGRPCServer) Get(ctx context.Context, req *storev1.GetRequest) (*storev1.GetResponse, error) {
	anno, err := s.store.Get(ctx, req.Namespace, req.Name)
	if err != nil {
		return nil, mapToGRPCStatus(err)
	}

	return &storev1.GetResponse{
		Annotation: toProtoAnnotation(anno),
	}, nil
}

func (s *mockGRPCServer) List(ctx context.Context, req *storev1.ListRequest) (*storev1.ListResponse, error) {
	opts := fromProtoListOptions(req.Options)

	result, err := s.store.List(ctx, req.Namespace, opts)
	if err != nil {
		return nil, mapToGRPCStatus(err)
	}

	items := make([]*storev1.Annotation, 0, len(result.Items))
	for i := range result.Items {
		items = append(items, toProtoAnnotation(&result.Items[i]))
	}

	return &storev1.ListResponse{
		Items:    items,
		Continue: result.Continue,
	}, nil
}

func (s *mockGRPCServer) Create(ctx context.Context, req *storev1.CreateRequest) (*storev1.CreateResponse, error) {
	anno := fromProtoAnnotation(req.Annotation)

	created, err := s.store.Create(ctx, anno)
	if err != nil {
		return nil, mapToGRPCStatus(err)
	}

	return &storev1.CreateResponse{
		Annotation: toProtoAnnotation(created),
	}, nil
}

func (s *mockGRPCServer) Update(ctx context.Context, req *storev1.UpdateRequest) (*storev1.UpdateResponse, error) {
	anno := fromProtoAnnotation(req.Annotation)

	updated, err := s.store.Update(ctx, anno)
	if err != nil {
		return nil, mapToGRPCStatus(err)
	}

	return &storev1.UpdateResponse{
		Annotation: toProtoAnnotation(updated),
	}, nil
}

func (s *mockGRPCServer) Delete(ctx context.Context, req *storev1.DeleteRequest) (*storev1.DeleteResponse, error) {
	err := s.store.Delete(ctx, req.Namespace, req.Name)
	if err != nil {
		return nil, mapToGRPCStatus(err)
	}

	return &storev1.DeleteResponse{}, nil
}

func (s *mockGRPCServer) Cleanup(ctx context.Context, req *storev1.CleanupRequest) (*storev1.CleanupResponse, error) {
	if s.lifecycle == nil {
		return nil, status.Error(codes.Unimplemented, "cleanup not supported")
	}

	count, err := s.lifecycle.Cleanup(ctx)
	if err != nil {
		return nil, mapToGRPCStatus(err)
	}

	return &storev1.CleanupResponse{
		DeletedCount: count,
	}, nil
}

func (s *mockGRPCServer) ListTags(ctx context.Context, req *storev1.ListTagsRequest) (*storev1.ListTagsResponse, error) {
	if s.tagProvider == nil {
		return nil, status.Error(codes.Unimplemented, "tag listing not supported")
	}

	opts := fromProtoTagListOptions(req.Options)

	tags, err := s.tagProvider.ListTags(ctx, req.Namespace, opts)
	if err != nil {
		return nil, mapToGRPCStatus(err)
	}

	protoTags := make([]*storev1.Tag, 0, len(tags))
	for _, tag := range tags {
		protoTags = append(protoTags, &storev1.Tag{
			Name:  tag.Name,
			Count: tag.Count,
		})
	}

	return &storev1.ListTagsResponse{
		Tags: protoTags,
	}, nil
}

func setupGRPCTest(t *testing.T) (Store, func()) {
	t.Helper()

	memStore := NewMemoryStore()

	const bufSize = 1024 * 1024
	lis := bufconn.Listen(bufSize)

	// Create and start mock gRPC server
	grpcServer := grpc.NewServer()
	storev1.RegisterAnnotationStoreServer(grpcServer, newMockGRPCServer(memStore))
	go func() {
		if err := grpcServer.Serve(lis); err != nil {
			t.Logf("Server exited with error: %v", err)
		}
	}()

	// Create gRPC client and store
	conn, err := grpc.NewClient("passthrough:///bufnet",
		grpc.WithContextDialer(func(context.Context, string) (net.Conn, error) {
			return lis.Dial()
		}),
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	require.NoError(t, err)
	grpcStore := NewStoreGRPC(conn)

	cleanup := func() {
		err := conn.Close()
		require.NoError(t, err)
		grpcServer.Stop()
		err = lis.Close()
		require.NoError(t, err)
	}

	return grpcStore, cleanup
}

func TestGRPCStore_CreateAndGet(t *testing.T) {
	store, cleanup := setupGRPCTest(t)
	defer cleanup()

	ctx := t.Context()
	namespace := metav1.NamespaceDefault

	// Create annotation
	anno := &annotationV0.Annotation{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-1",
			Namespace: namespace,
		},
		Spec: annotationV0.AnnotationSpec{
			Text: "Test annotation",
			Time: 1000,
			Tags: []string{"tag1", "tag2"},
		},
	}
	anno.SetCreatedBy("user:test-user-123")

	created, err := store.Create(ctx, anno)
	require.NoError(t, err)
	assert.Equal(t, "test-1", created.Name)
	assert.Equal(t, namespace, created.Namespace)
	assert.Equal(t, "Test annotation", created.Spec.Text)
	assert.Equal(t, int64(1000), created.Spec.Time)
	assert.Equal(t, []string{"tag1", "tag2"}, created.Spec.Tags)
	assert.Equal(t, "user:test-user-123", created.GetCreatedBy())

	// Get annotation
	retrieved, err := store.Get(ctx, namespace, "test-1")
	require.NoError(t, err)
	assert.Equal(t, created.Name, retrieved.Name)
	assert.Equal(t, created.Spec.Text, retrieved.Spec.Text)
	assert.Equal(t, created.Spec.Time, retrieved.Spec.Time)
	assert.Equal(t, "user:test-user-123", retrieved.GetCreatedBy())
}

func TestGRPCStore_Update(t *testing.T) {
	store, cleanup := setupGRPCTest(t)
	defer cleanup()

	ctx := t.Context()
	namespace := metav1.NamespaceDefault

	// Create annotation
	anno := &annotationV0.Annotation{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-1",
			Namespace: namespace,
		},
		Spec: annotationV0.AnnotationSpec{
			Text: "Original text",
			Time: 1000,
			Tags: []string{"tag1"},
		},
	}
	created, err := store.Create(ctx, anno)
	require.NoError(t, err)

	// Update annotation
	created.Spec.Text = "Updated text"
	created.Spec.Tags = []string{"tag1", "tag2", "tag3"}

	updated, err := store.Update(ctx, created)
	require.NoError(t, err)
	assert.Equal(t, "Updated text", updated.Spec.Text)
	assert.Equal(t, []string{"tag1", "tag2", "tag3"}, updated.Spec.Tags)

	// Verify update persisted
	retrieved, err := store.Get(ctx, namespace, "test-1")
	require.NoError(t, err)
	assert.Equal(t, "Updated text", retrieved.Spec.Text)
	assert.Equal(t, []string{"tag1", "tag2", "tag3"}, retrieved.Spec.Tags)
}

func TestGRPCStore_Delete(t *testing.T) {
	store, cleanup := setupGRPCTest(t)
	defer cleanup()

	ctx := t.Context()
	namespace := metav1.NamespaceDefault

	// Create annotation
	anno := &annotationV0.Annotation{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-1",
			Namespace: namespace,
		},
		Spec: annotationV0.AnnotationSpec{
			Text: "Test annotation",
			Time: 1000,
			Tags: []string{"tag1"},
		},
	}
	_, err := store.Create(ctx, anno)
	require.NoError(t, err)

	// Delete annotation
	err = store.Delete(ctx, namespace, "test-1")
	require.NoError(t, err)

	// Verify deletion
	_, err = store.Get(ctx, namespace, "test-1")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
}

func TestGRPCStore_List(t *testing.T) {
	store, cleanup := setupGRPCTest(t)
	defer cleanup()

	ctx := t.Context()
	namespace := metav1.NamespaceDefault

	// Create multiple annotations
	dashUID := "dash-1"
	panelID := int64(5)
	annotations := []*annotationV0.Annotation{
		{
			ObjectMeta: metav1.ObjectMeta{Name: "anno-1", Namespace: namespace, Annotations: map[string]string{"grafana.com/createdBy": "user:alice"}},
			Spec:       annotationV0.AnnotationSpec{Text: "First", Time: 1000, DashboardUID: &dashUID, PanelID: &panelID, Tags: []string{"tag1", "tag2"}},
		},
		{
			ObjectMeta: metav1.ObjectMeta{Name: "anno-2", Namespace: namespace, Annotations: map[string]string{"grafana.com/createdBy": "user:bob"}},
			Spec:       annotationV0.AnnotationSpec{Text: "Second", Time: 2000, Tags: []string{"tag2", "tag3"}},
		},
		{
			ObjectMeta: metav1.ObjectMeta{Name: "anno-3", Namespace: namespace, Annotations: map[string]string{"grafana.com/createdBy": "user:alice"}},
			Spec:       annotationV0.AnnotationSpec{Text: "Third", Time: 3000, Tags: []string{"tag1"}},
		},
	}

	for _, anno := range annotations {
		_, err := store.Create(ctx, anno)
		require.NoError(t, err)
	}

	t.Run("list all", func(t *testing.T) {
		result, err := store.List(ctx, namespace, ListOptions{})
		require.NoError(t, err)
		assert.Len(t, result.Items, 3)
	})

	t.Run("list with limit", func(t *testing.T) {
		result, err := store.List(ctx, namespace, ListOptions{Limit: 2})
		require.NoError(t, err)
		assert.Len(t, result.Items, 2)
	})

	t.Run("list with time range", func(t *testing.T) {
		result, err := store.List(ctx, namespace, ListOptions{
			From: 1500,
			To:   2500,
		})
		require.NoError(t, err)
		assert.Len(t, result.Items, 1)
		assert.Equal(t, "Second", result.Items[0].Spec.Text)
	})

	t.Run("list with dashboard filter", func(t *testing.T) {
		result, err := store.List(ctx, namespace, ListOptions{
			DashboardUID: dashUID,
		})
		require.NoError(t, err)
		assert.Len(t, result.Items, 1)
		assert.Equal(t, "First", result.Items[0].Spec.Text)
	})

	t.Run("list with tags (match all)", func(t *testing.T) {
		result, err := store.List(ctx, namespace, ListOptions{
			Tags:         []string{"tag2", "tag3"},
			TagsMatchAny: false,
		})
		require.NoError(t, err)
		assert.Len(t, result.Items, 1)
		assert.Equal(t, "Second", result.Items[0].Spec.Text)
	})

	t.Run("list with tags (match any)", func(t *testing.T) {
		result, err := store.List(ctx, namespace, ListOptions{
			Tags:         []string{"tag2", "tag3"},
			TagsMatchAny: true,
		})
		require.NoError(t, err)
		assert.Len(t, result.Items, 2)
	})

	t.Run("list with created_by filter", func(t *testing.T) {
		result, err := store.List(ctx, namespace, ListOptions{
			CreatedBy: "user:alice",
		})
		require.NoError(t, err)
		assert.Len(t, result.Items, 2)
		assert.Equal(t, "user:alice", result.Items[0].GetCreatedBy())
		assert.Equal(t, "user:alice", result.Items[1].GetCreatedBy())
	})
}

func TestGRPCStore_ListTags(t *testing.T) {
	store, cleanup := setupGRPCTest(t)
	defer cleanup()

	ctx := t.Context()
	namespace := metav1.NamespaceDefault

	// Create annotations with various tags
	annotations := []*annotationV0.Annotation{
		{
			ObjectMeta: metav1.ObjectMeta{Name: "anno-1", Namespace: namespace},
			Spec:       annotationV0.AnnotationSpec{Text: "First", Time: 1000, Tags: []string{"prod", "error"}},
		},
		{
			ObjectMeta: metav1.ObjectMeta{Name: "anno-2", Namespace: namespace},
			Spec:       annotationV0.AnnotationSpec{Text: "Second", Time: 2000, Tags: []string{"prod", "warning"}},
		},
		{
			ObjectMeta: metav1.ObjectMeta{Name: "anno-3", Namespace: namespace},
			Spec:       annotationV0.AnnotationSpec{Text: "Third", Time: 3000, Tags: []string{"dev", "error"}},
		},
	}

	for _, anno := range annotations {
		_, err := store.Create(ctx, anno)
		require.NoError(t, err)
	}

	// List all tags
	grpcStore := store.(*storeGRPC)
	tags, err := grpcStore.ListTags(ctx, namespace, TagListOptions{})
	require.NoError(t, err)
	assert.Len(t, tags, 4) // prod, error, warning, dev

	// Verify tag counts
	tagMap := make(map[string]int64)
	for _, tag := range tags {
		tagMap[tag.Name] = tag.Count
	}
	assert.Equal(t, int64(2), tagMap["prod"])
	assert.Equal(t, int64(2), tagMap["error"])
	assert.Equal(t, int64(1), tagMap["warning"])
	assert.Equal(t, int64(1), tagMap["dev"])
}

func TestGRPCStore_ErrorCases(t *testing.T) {
	store, cleanup := setupGRPCTest(t)
	defer cleanup()

	ctx := t.Context()
	namespace := metav1.NamespaceDefault

	t.Run("get non-existent annotation", func(t *testing.T) {
		_, err := store.Get(ctx, namespace, "does-not-exist")
		require.Error(t, err)
		assert.Contains(t, err.Error(), "not found")
	})

	t.Run("update non-existent annotation", func(t *testing.T) {
		anno := &annotationV0.Annotation{
			ObjectMeta: metav1.ObjectMeta{Name: "does-not-exist", Namespace: namespace},
			Spec:       annotationV0.AnnotationSpec{Text: "Test", Time: 1000},
		}
		_, err := store.Update(ctx, anno)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "not found")
	})

	t.Run("create duplicate annotation", func(t *testing.T) {
		anno := &annotationV0.Annotation{
			ObjectMeta: metav1.ObjectMeta{Name: "test-1", Namespace: namespace},
			Spec:       annotationV0.AnnotationSpec{Text: "First", Time: 1000},
		}
		_, err := store.Create(ctx, anno)
		require.NoError(t, err)

		// Try to create again
		_, err = store.Create(ctx, anno)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "already exists")
	})

	t.Run("delete non-existent annotation", func(t *testing.T) {
		err := store.Delete(ctx, namespace, "does-not-exist")
		require.Error(t, err)
		assert.Contains(t, err.Error(), "not found")
	})
}
