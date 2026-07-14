package sql

import (
	"context"
	"fmt"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/metadata"

	"github.com/grafana/dskit/services"
	shorturlv1beta1 "github.com/grafana/grafana/apps/shorturl/pkg/apis/shorturl/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	infraDB "github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/dbimpl"
)

const shortURLBenchmarkRows = 26000

func BenchmarkShortURLBulkProcessBatching(b *testing.B) {
	b.Setenv("SQLITE_TEST_DB", filepath.Join(b.TempDir(), "shorturl-benchmark.db"))

	store := infraDB.InitTestDB(b)
	cfg := setting.NewCfg()
	resourceDB, err := dbimpl.ProvideResourceDB(store, cfg, nil)
	require.NoError(b, err)

	backend, err := NewBackend(BackendOptions{
		DBProvider: resourceDB,
	})
	require.NoError(b, err)

	ctx := context.Background()
	svc, ok := backend.(services.Service)
	require.True(b, ok)
	require.NoError(b, services.StartAndAwaitRunning(ctx, svc))
	b.Cleanup(func() {
		_ = services.StopAndAwaitTerminated(context.Background(), svc)
	})

	requests := buildShortURLBulkRequests(shortURLBenchmarkRows)
	settings := resource.BulkSettings{
		SkipValidation: true,
		Collection: []*resourcepb.ResourceKey{
			{
				Namespace: "default",
				Group:     shorturlv1beta1.APIGroup,
				Resource:  "shorturls",
			},
		},
	}

	runBenchmark := func(b *testing.B, maxItems, maxBytes int, maxIdle time.Duration) {
		batchOpts := resource.DefaultBulkBatchOptions()
		batchOpts.MaxItems = maxItems
		batchOpts.MaxBytes = maxBytes
		batchOpts.MaxIdle = maxIdle

		server, err := resource.NewResourceServer(resource.ResourceServerOptions{
			Backend:          backend,
			BulkBatchOptions: &batchOpts,
		})
		require.NoError(b, err)
		b.Cleanup(func() {
			require.NoError(b, server.Stop(context.Background()))
		})

		client := resource.NewLocalResourceClient(server)
		b.ReportAllocs()
		b.ResetTimer()

		for range b.N {
			resp, err := runShortURLBulkProcessBenchmark(ctx, client, settings, requests)
			require.NoError(b, err)
			require.NotNil(b, resp)
			require.Nil(b, resp.Error)
			require.Equal(b, int64(shortURLBenchmarkRows), resp.Processed)
		}
	}

	cases := []struct {
		name     string
		maxItems int
		maxBytes int
		maxIdle  time.Duration
	}{
		{
			name:     "batch_size_1",
			maxItems: 1,
			maxBytes: 1 << 20,
		},
		{
			name:     "batch_size_4",
			maxItems: 4,
			maxBytes: 1 << 20,
		},
		{
			name:     "batch_size_8",
			maxItems: 8,
			maxBytes: 1 << 20,
		},
		{
			name:     "batch_size_16",
			maxItems: 16,
			maxBytes: 1 << 20,
		},
		{
			name:     "batch_size_32",
			maxItems: 32,
			maxBytes: 1 << 20,
		},
		{
			name:     "batch_size_128",
			maxItems: 128,
			maxBytes: 1 << 20,
		},
		{
			name:     "batched_default",
			maxItems: 1000,
			maxBytes: 2 * 1024 * 1024,
			maxIdle:  5 * time.Millisecond,
		},
	}

	for _, tc := range cases {
		b.Run(tc.name, func(b *testing.B) {
			runBenchmark(b, tc.maxItems, tc.maxBytes, tc.maxIdle)
		})
	}
}

func runShortURLBulkProcessBenchmark(
	ctx context.Context,
	client resource.ResourceClient,
	settings resource.BulkSettings,
	requests []*resourcepb.BulkRequest,
) (*resourcepb.BulkResponse, error) {
	if len(settings.Collection) > 0 {
		ctx = identity.WithServiceIdentityForSingleNamespaceContext(ctx, settings.Collection[0].Namespace)
	}
	streamCtx := metadata.NewOutgoingContext(ctx, settings.ToMD())
	stream, err := client.BulkProcess(streamCtx)
	if err != nil {
		return nil, err
	}
	for _, req := range requests {
		if err := stream.Send(req); err != nil {
			return nil, err
		}
	}
	return stream.CloseAndRecv()
}

func buildShortURLBulkRequests(count int) []*resourcepb.BulkRequest {
	requests := make([]*resourcepb.BulkRequest, 0, count)
	for i := range count {
		name := fmt.Sprintf("bench-shorturl-%05d", i)
		requests = append(requests, &resourcepb.BulkRequest{
			Key: &resourcepb.ResourceKey{
				Namespace: "default",
				Group:     shorturlv1beta1.APIGroup,
				Resource:  "shorturls",
				Name:      name,
			},
			Action: resourcepb.BulkRequest_ADDED,
			Value: []byte(`{"apiVersion":"shorturl.grafana.app/v1beta1","kind":"ShortURL","metadata":{"name":"` +
				name + `","namespace":"default"},"spec":{"path":"d/bench/` + fmt.Sprintf("%05d", i) + `"}}`),
		})
	}
	return requests
}
