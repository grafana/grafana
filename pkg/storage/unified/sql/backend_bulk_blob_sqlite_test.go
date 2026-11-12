package sql

import (
	"context"
	"net"
	"os"
	"testing"
	"time"

	"github.com/grafana/dskit/services"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/test/bufconn"

	authlib "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/dbimpl"
)

func TestBulkProcessNegotiatedBlobUploadWithSQLite(t *testing.T) {
	testDB, hadTestDB := os.LookupEnv("GRAFANA_TEST_DB")
	require.NoError(t, os.Unsetenv("GRAFANA_TEST_DB"))
	t.Cleanup(func() {
		if hadTestDB {
			require.NoError(t, os.Setenv("GRAFANA_TEST_DB", testDB))
		}
	})
	ctx := t.Context()
	dbstore := db.NewTestStore(t)
	eDB, err := dbimpl.ProvideResourceDB(dbstore, setting.NewCfg(), nil)
	require.NoError(t, err)

	storageBackend, err := NewBackend(BackendOptions{
		DBProvider:             eDB,
		DisablePruner:          true,
		MigrationParquetBuffer: false,
	})
	require.NoError(t, err)
	backend := storageBackend.(*backend)
	require.Equal(t, "sqlite", backend.dialect.DialectName())
	require.False(t, backend.migrationParquetBuffer)

	svc := storageBackend.(services.Service)
	require.NoError(t, services.StartAndAwaitRunning(ctx, svc))
	t.Cleanup(func() { require.NoError(t, services.StopAndAwaitTerminated(context.Background(), svc)) })

	blobBackend := storageBackend.(resource.BlobSupport)
	server, err := resource.NewResourceServer(resource.ResourceServerOptions{
		Backend: storageBackend,
		Blob:    resource.BlobConfig{Backend: blobBackend},
	})
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, server.Stop(context.Background())) })

	listener := bufconn.Listen(1 << 20)
	grpcServer := grpc.NewServer(grpc.StreamInterceptor(func(_ any, stream grpc.ServerStream, _ *grpc.StreamServerInfo, next grpc.StreamHandler) error {
		streamCtx := authlib.WithAuthInfo(stream.Context(), testBulkBlobRequester())
		return next(server, bulkBlobContextStream{ServerStream: stream, ctx: streamCtx})
	}))
	resourcepb.RegisterBulkStoreServer(grpcServer, server)
	go func() { _ = grpcServer.Serve(listener) }()
	t.Cleanup(func() {
		grpcServer.Stop()
		require.NoError(t, listener.Close())
	})

	conn, err := grpc.NewClient("passthrough:///bulk-blob-sqlite",
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithContextDialer(func(context.Context, string) (net.Conn, error) { return listener.Dial() }),
	)
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, conn.Close()) })

	key := &resourcepb.ResourceKey{
		Namespace: "default",
		Group:     "shorturl.grafana.app",
		Resource:  "shorturls",
		Name:      "item-with-blob",
	}
	settings := resource.BulkSettings{Collection: []*resourcepb.ResourceKey{{
		Namespace: key.Namespace,
		Group:     key.Group,
		Resource:  key.Resource,
	}}}
	md := metadata.Join(settings.ToMD(), metadata.Pairs(resourcepb.InlineBlobMetadataKey, "1"))
	bulkCtx, cancel := context.WithTimeout(metadata.NewOutgoingContext(ctx, md), 10*time.Second)
	defer cancel()

	stream, err := resourcepb.NewBulkStoreClient(conn).BulkProcess(bulkCtx)
	require.NoError(t, err)
	header, err := stream.Header()
	require.NoError(t, err)
	require.NoError(t, resourcepb.ValidateInlineBlobAcknowledgement(header))
	require.NoError(t, stream.Send(&resourcepb.BulkRequest{
		Key:    key,
		Action: resourcepb.BulkRequest_ADDED,
		Value:  []byte(`{"apiVersion":"shorturl.grafana.app/v1beta1","kind":"ShortURL","metadata":{"name":"item-with-blob","namespace":"default"},"spec":{"path":"d/test"}}`),
		BlobUploads: []*resourcepb.BulkBlobUpload{{
			Name:        "document",
			ContentType: "text/plain",
			Size:        13,
		}},
	}))
	require.NoError(t, stream.Send(&resourcepb.BulkRequest{BlobChunk: &resourcepb.BulkBlobChunk{Name: "document", Value: []byte("blob contents")}}))
	require.NoError(t, stream.Send(&resourcepb.BulkRequest{BlobChunk: &resourcepb.BulkBlobChunk{Name: "document", Last: true}}))
	response, err := stream.CloseAndRecv()
	require.NoError(t, err)
	require.EqualValues(t, 1, response.Processed)

	readCtx := authlib.WithAuthInfo(ctx, testBulkBlobRequester())
	readResponse, err := server.Read(readCtx, &resourcepb.ReadRequest{Key: key})
	require.NoError(t, err)
	body, err := resourcepb.DecodeBlobObject(readResponse.Value)
	require.NoError(t, err)
	blobs, err := resourcepb.DecodeBlobEntries(body["blobs"])
	require.NoError(t, err)
	require.NotEmpty(t, blobs["document"].UID)

	blobResponse, err := server.GetBlob(readCtx, &resourcepb.GetBlobRequest{
		Resource:       key,
		Uid:            blobs["document"].UID,
		MustProxyBytes: true,
	})
	require.NoError(t, err)
	require.Equal(t, "text/plain", blobResponse.ContentType)
	require.Equal(t, []byte("blob contents"), blobResponse.Value)
}

func testBulkBlobRequester() *identity.StaticRequester {
	return &identity.StaticRequester{Type: authlib.TypeUser, UserUID: "u1", OrgRole: identity.RoleAdmin, Namespace: "default"}
}

type bulkBlobContextStream struct {
	grpc.ServerStream
	ctx context.Context
}

func (s bulkBlobContextStream) Context() context.Context { return s.ctx }
