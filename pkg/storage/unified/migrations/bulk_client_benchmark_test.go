package migrations

import (
	"context"
	"errors"
	"fmt"
	"io"
	"testing"

	"github.com/fullstorydev/grpchan/inprocgrpc"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func BenchmarkBulkProcessWireBatching(b *testing.B) {
	client := newBenchmarkBulkStoreClient()
	requests := buildBenchmarkBulkRequests(26000)

	b.ResetTimer()

	cases := []struct {
		name string
		run  func(context.Context, resourcepb.BulkStoreClient, []*resourcepb.BulkRequest) error
	}{
		{
			name: "single_request_stream",
			run:  runBenchmarkBulkProcess,
		},
		{
			name: "batched_size_1",
			run: func(ctx context.Context, client resourcepb.BulkStoreClient, requests []*resourcepb.BulkRequest) error {
				return runBenchmarkBulkProcessBatched(ctx, client, requests, bulkProcessBatchOptions{MaxItems: 1, MaxBytes: 2 * 1024 * 1024})
			},
		},
		{
			name: "batched_default",
			run: func(ctx context.Context, client resourcepb.BulkStoreClient, requests []*resourcepb.BulkRequest) error {
				return runBenchmarkBulkProcessBatched(ctx, client, requests, defaultBulkProcessBatchOptions())
			},
		},
	}

	for _, tc := range cases {
		b.Run(tc.name, func(b *testing.B) {
			for i := 0; i < b.N; i++ {
				if err := tc.run(context.Background(), client, requests); err != nil {
					b.Fatal(err)
				}
			}
		})
	}
}

func newBenchmarkBulkStoreClient() resourcepb.BulkStoreClient {
	channel := &inprocgrpc.Channel{}
	resourcepb.RegisterBulkStoreServer(channel, benchmarkBulkStoreServer{})
	return resourcepb.NewBulkStoreClient(channel)
}

func runBenchmarkBulkProcess(ctx context.Context, client resourcepb.BulkStoreClient, requests []*resourcepb.BulkRequest) error {
	stream, err := client.BulkProcess(ctx)
	if err != nil {
		return err
	}

	for _, req := range requests {
		if err := stream.Send(req); err != nil {
			return err
		}
	}

	_, err = stream.CloseAndRecv()
	return err
}

func runBenchmarkBulkProcessBatched(ctx context.Context, client resourcepb.BulkStoreClient, requests []*resourcepb.BulkRequest, opts bulkProcessBatchOptions) error {
	stream, err := client.BulkProcessBatched(ctx)
	if err != nil {
		return err
	}

	batched := newBulkProcessBatchingClient(stream, opts)
	for _, req := range requests {
		if err := batched.Send(req); err != nil {
			return err
		}
	}

	_, err = batched.CloseAndRecv()
	return err
}

func buildBenchmarkBulkRequests(count int) []*resourcepb.BulkRequest {
	requests := make([]*resourcepb.BulkRequest, 0, count)
	for i := 0; i < count; i++ {
		name := fmt.Sprintf("bench-shorturl-%05d", i)
		requests = append(requests, &resourcepb.BulkRequest{
			Key: &resourcepb.ResourceKey{
				Namespace: "default",
				Group:     "shorturl.grafana.app",
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

type benchmarkBulkStoreServer struct {
	resourcepb.UnimplementedBulkStoreServer
}

func (benchmarkBulkStoreServer) BulkProcess(stream resourcepb.BulkStore_BulkProcessServer) error {
	var processed int64
	for {
		_, err := stream.Recv()
		if errors.Is(err, io.EOF) {
			return stream.SendAndClose(&resourcepb.BulkResponse{Processed: processed})
		}
		if err != nil {
			return err
		}
		processed++
	}
}

func (benchmarkBulkStoreServer) BulkProcessBatched(stream resourcepb.BulkStore_BulkProcessBatchedServer) error {
	var processed int64
	for {
		batch, err := stream.Recv()
		if errors.Is(err, io.EOF) {
			return stream.SendAndClose(&resourcepb.BulkResponse{Processed: processed})
		}
		if err != nil {
			return err
		}
		processed += int64(len(batch.Items))
	}
}
