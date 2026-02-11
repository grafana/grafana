package store

import (
	"context"
	"io"
	"testing"

	"github.com/fullstorydev/grpchan/inprocgrpc"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/openfga/openfga/pkg/storage"
	"github.com/openfga/openfga/pkg/storage/memory"
	tupleutils "github.com/openfga/openfga/pkg/tuple"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"

	"github.com/grafana/grafana/pkg/infra/log"
	tuplepb "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/setting"
)

func TestNewTupleStorageAdapter_RequiresTupleServiceAddrWhenCustomMode(t *testing.T) {
	t.Parallel()
	cfg := &setting.Cfg{}
	cfg.ZanzanaServer.StorageMode = setting.ZanzanaStorageModeCustom
	cfg.ZanzanaServer.TupleServiceAddr = ""

	_, err := NewTupleStorageAdapter(cfg, log.NewNopLogger(), nil)
	require.Error(t, err)
	require.ErrorIs(t, err, ErrTupleServiceAddrRequired)
}

func TestTupleStorageAdapter_StoresCRUD(t *testing.T) {
	t.Parallel()
	// Use a no-op tuple client; we only test in-memory stores here.
	mockClient := &mockTupleStorageClient{}
	cfg := &setting.Cfg{}
	cfg.ZanzanaServer.StorageMode = setting.ZanzanaStorageModeCustom
	cfg.ZanzanaServer.TupleServiceAddr = "localhost:0" // not used when client provided

	adapter, err := NewTupleStorageAdapter(cfg, log.NewNopLogger(), mockClient)
	require.NoError(t, err)
	defer adapter.Close()

	ctx := context.Background()

	// CreateStore: ID is always derived from name (deterministic), so we use the returned ID.
	store, err := adapter.CreateStore(ctx, &openfgav1.Store{Name: "Store 1"})
	require.NoError(t, err)
	require.Len(t, store.GetId(), 26)
	require.Equal(t, "Store 1", store.GetName())
	storeID := store.GetId()

	// GetStore
	got, err := adapter.GetStore(ctx, storeID)
	require.NoError(t, err)
	require.Equal(t, storeID, got.GetId())

	// ListStores
	list, token, err := adapter.ListStores(ctx, storage.ListStoresOptions{})
	require.NoError(t, err)
	require.Len(t, list, 1)
	require.Equal(t, storeID, list[0].GetId())
	require.Equal(t, "Store 1", list[0].GetName())
	require.Empty(t, token)

	// DeleteStore
	err = adapter.DeleteStore(ctx, storeID)
	require.NoError(t, err)
	_, err = adapter.GetStore(ctx, storeID)
	require.ErrorIs(t, err, storage.ErrNotFound)
	list, _, err = adapter.ListStores(ctx, storage.ListStoresOptions{})
	require.NoError(t, err)
	require.Empty(t, list)
}

func TestTupleStorageAdapter_CreateStoreWithNameOnlyGeneratesDeterministicID(t *testing.T) {
	t.Parallel()
	mockClient := &mockTupleStorageClient{}
	cfg := &setting.Cfg{}
	cfg.ZanzanaServer.StorageMode = setting.ZanzanaStorageModeCustom
	cfg.ZanzanaServer.TupleServiceAddr = "localhost:0"

	ctx := context.Background()
	// Same name yields same ID across adapter instances (deterministic from name).
	adapter1, err := NewTupleStorageAdapter(cfg, log.NewNopLogger(), mockClient)
	require.NoError(t, err)
	defer adapter1.Close()
	store1, err := adapter1.CreateStore(ctx, &openfgav1.Store{Name: "default"})
	require.NoError(t, err)
	require.Equal(t, "default", store1.GetName())
	require.Len(t, store1.GetId(), 26)

	adapter2, err := NewTupleStorageAdapter(cfg, log.NewNopLogger(), mockClient)
	require.NoError(t, err)
	defer adapter2.Close()
	store2, err := adapter2.CreateStore(ctx, &openfgav1.Store{Name: "default"})
	require.NoError(t, err)
	require.Equal(t, store1.GetId(), store2.GetId(), "same name must yield same store ID")

	// Different name yields different ID.
	store3, err := adapter2.CreateStore(ctx, &openfgav1.Store{Name: "other"})
	require.NoError(t, err)
	require.NotEqual(t, store2.GetId(), store3.GetId())
}

func TestTupleStorageAdapter_AuthorizationModelInMemory(t *testing.T) {
	t.Parallel()
	mockClient := &mockTupleStorageClient{}
	cfg := &setting.Cfg{}
	cfg.ZanzanaServer.StorageMode = setting.ZanzanaStorageModeCustom
	cfg.ZanzanaServer.TupleServiceAddr = "localhost:0"

	adapter, err := NewTupleStorageAdapter(cfg, log.NewNopLogger(), mockClient)
	require.NoError(t, err)
	defer adapter.Close()

	ctx := context.Background()
	storeID := "store-1"

	model := &openfgav1.AuthorizationModel{
		Id: "model-1",
		TypeDefinitions: []*openfgav1.TypeDefinition{
			{Type: "document", Relations: map[string]*openfgav1.Userset{"viewer": {Userset: &openfgav1.Userset_This{}}}},
		},
	}
	err = adapter.WriteAuthorizationModel(ctx, storeID, model)
	require.NoError(t, err)

	read, err := adapter.ReadAuthorizationModel(ctx, storeID, "model-1")
	require.NoError(t, err)
	require.Equal(t, "model-1", read.GetId())

	latest, err := adapter.FindLatestAuthorizationModel(ctx, storeID)
	require.NoError(t, err)
	require.Equal(t, "model-1", latest.GetId())
}

func TestTupleStorageAdapter_AssertionsInMemory(t *testing.T) {
	t.Parallel()
	mockClient := &mockTupleStorageClient{}
	cfg := &setting.Cfg{}
	cfg.ZanzanaServer.StorageMode = setting.ZanzanaStorageModeCustom
	cfg.ZanzanaServer.TupleServiceAddr = "localhost:0"

	adapter, err := NewTupleStorageAdapter(cfg, log.NewNopLogger(), mockClient)
	require.NoError(t, err)
	defer adapter.Close()

	ctx := context.Background()
	storeID := "store-1"
	modelID := "model-1"

	assertions := []*openfgav1.Assertion{
		{TupleKey: &openfgav1.AssertionTupleKey{Object: "doc:1", Relation: "viewer", User: "user:alice"}, Expectation: true},
	}
	err = adapter.WriteAssertions(ctx, storeID, modelID, assertions)
	require.NoError(t, err)

	read, err := adapter.ReadAssertions(ctx, storeID, modelID)
	require.NoError(t, err)
	require.Len(t, read, 1)
	require.True(t, read[0].GetExpectation())
}

// mockTupleStorageClient returns empty/error for tuple RPCs so we can test control plane only.
type mockTupleStorageClient struct{}

func (m *mockTupleStorageClient) WriteTuples(ctx context.Context, req *tuplepb.WriteTuplesRequest, opts ...grpc.CallOption) (*tuplepb.WriteTuplesResponse, error) {
	return &tuplepb.WriteTuplesResponse{}, nil
}

func (m *mockTupleStorageClient) ReadTuples(ctx context.Context, req *tuplepb.ReadTuplesRequest, opts ...grpc.CallOption) (tuplepb.TupleStorageService_ReadTuplesClient, error) {
	return &mockReadTuplesClient{}, nil
}

func (m *mockTupleStorageClient) ReadTuplesByUser(ctx context.Context, req *tuplepb.ReadTuplesByUserRequest, opts ...grpc.CallOption) (tuplepb.TupleStorageService_ReadTuplesByUserClient, error) {
	return &mockReadTuplesByUserClient{}, nil
}

func (m *mockTupleStorageClient) ReadChanges(ctx context.Context, req *tuplepb.ReadChangesRequest, opts ...grpc.CallOption) (*tuplepb.ReadChangesResponse, error) {
	return &tuplepb.ReadChangesResponse{}, nil
}

type mockReadTuplesClient struct {
	grpc.ClientStream
}

func (m *mockReadTuplesClient) Recv() (*tuplepb.StorageTuple, error) {
	return nil, io.EOF
}

type mockReadTuplesByUserClient struct {
	grpc.ClientStream
}

func (m *mockReadTuplesByUserClient) Recv() (*tuplepb.StorageTuple, error) {
	return nil, io.EOF
}

// Integration test: adapter + SQL server (backed by memory datastore) round-trip tuples.
func TestTupleStorageAdapter_Integration_WriteReadTuples(t *testing.T) {
	t.Parallel()
	ctx := context.Background()

	// Backend: in-memory OpenFGA datastore
	memDS := memory.New()
	defer memDS.Close()

	// Expose it via our TupleStorageService (SQL server wraps any OpenFGADatastore)
	sqlServer := NewTupleStorageSQLServer(memDS, nil)
	channel := &inprocgrpc.Channel{}
	tuplepb.RegisterTupleStorageServiceServer(channel, sqlServer)
	client := tuplepb.NewTupleStorageServiceClient(channel)

	// Adapter with this client (no real gRPC dial)
	cfg := &setting.Cfg{}
	cfg.ZanzanaServer.StorageMode = setting.ZanzanaStorageModeCustom
	cfg.ZanzanaServer.TupleServiceAddr = "localhost:0"
	adapter, err := NewTupleStorageAdapter(cfg, log.NewNopLogger(), client)
	require.NoError(t, err)
	defer adapter.Close()

	// Create store and model in adapter (in-memory); ID is derived from name.
	store, err := adapter.CreateStore(ctx, &openfgav1.Store{Name: "Test Store"})
	require.NoError(t, err)
	storeID := store.GetId()
	model := &openfgav1.AuthorizationModel{
		Id: "model-1",
		TypeDefinitions: []*openfgav1.TypeDefinition{
			{Type: "document", Relations: map[string]*openfgav1.Userset{"viewer": {Userset: &openfgav1.Userset_This{}}}},
		},
	}
	err = adapter.WriteAuthorizationModel(ctx, storeID, model)
	require.NoError(t, err)

	// Write tuples via adapter (hits mock -> actually our SQL server -> memory)
	writes := storage.Writes{
		tupleutils.NewTupleKey("document:1", "viewer", "user:alice"),
		tupleutils.NewTupleKey("document:2", "viewer", "user:bob"),
	}
	err = adapter.Write(ctx, storeID, nil, writes)
	require.NoError(t, err)

	// ReadPage via adapter
	filter := storage.ReadFilter{Object: "document:1", Relation: "viewer", User: ""}
	tuples, token, err := adapter.ReadPage(ctx, storeID, filter, storage.ReadPageOptions{
		Pagination: storage.PaginationOptions{PageSize: 10},
	})
	require.NoError(t, err)
	require.Len(t, tuples, 1)
	require.Equal(t, "document:1", tuples[0].GetKey().GetObject())
	require.Equal(t, "user:alice", tuples[0].GetKey().GetUser())
	require.Empty(t, token)
}
