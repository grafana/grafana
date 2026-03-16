package sql

import (
	"context"
	"fmt"
	"path/filepath"
	"testing"
	"time"

	"github.com/grafana/dskit/services"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/metadata"

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

	server, err := resource.NewResourceServer(resource.ResourceServerOptions{
		Backend: backend,
	})
	require.NoError(b, err)

	client := resource.NewLocalResourceClient(server)
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

	runBenchmark := func(b *testing.B, batchOpts resource.BulkBatchOptions) {
		restore := resource.SetBulkBatchOptionsForTesting(batchOpts)
		b.Cleanup(restore)
		b.ReportAllocs()
		b.ResetTimer()

		for i := 0; i < b.N; i++ {
			resp, err := runShortURLBulkProcessBenchmark(ctx, client, settings, requests)
			require.NoError(b, err)
			require.NotNil(b, resp)
			require.Nil(b, resp.Error)
			require.Equal(b, int64(shortURLBenchmarkRows), resp.Processed)
		}
	}

	cases := []struct {
		name string
		opts resource.BulkBatchOptions
	}{
		{
			name: "batch_size_1",
			opts: resource.BulkBatchOptions{
				MaxItems: 1,
				MaxBytes: 1 << 20,
			},
		},
		{
			name: "batch_size_4",
			opts: resource.BulkBatchOptions{
				MaxItems: 4,
				MaxBytes: 1 << 20,
			},
		},
		{
			name: "batch_size_8",
			opts: resource.BulkBatchOptions{
				MaxItems: 8,
				MaxBytes: 1 << 20,
			},
		},
		{
			name: "batch_size_16",
			opts: resource.BulkBatchOptions{
				MaxItems: 16,
				MaxBytes: 1 << 20,
			},
		},
		{
			name: "batch_size_32",
			opts: resource.BulkBatchOptions{
				MaxItems: 32,
				MaxBytes: 1 << 20,
			},
		},
		{
			name: "batch_size_128",
			opts: resource.BulkBatchOptions{
				MaxItems: 128,
				MaxBytes: 1 << 20,
			},
		},
		{
			name: "batched_default",
			opts: resource.BulkBatchOptions{
				MaxItems: 1000,
				MaxBytes: 2 * 1024 * 1024,
				MaxIdle:  5 * time.Millisecond,
			},
		},
	}

	for _, tc := range cases {
		b.Run(tc.name, func(b *testing.B) {
			runBenchmark(b, tc.opts)
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
	for i := 0; i < count; i++ {
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
