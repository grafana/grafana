package migrations_test

import (
	"context"
	"errors"
	"testing"
	"testing/synctest"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/storage/unified/migrations"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type blobProducerStream struct {
	grpc.ClientStream
	ctx           context.Context
	headers       metadata.MD
	headerErr     error
	headerCalls   int
	waitForCancel bool
	response      *resourcepb.BulkResponse
	closeErr      error
}

func (s *blobProducerStream) Header() (metadata.MD, error) {
	s.headerCalls++
	if s.waitForCancel {
		<-s.ctx.Done()
		return nil, s.ctx.Err()
	}
	return s.headers, s.headerErr
}

func (s *blobProducerStream) Send(*resourcepb.BulkRequest) error { return nil }
func (s *blobProducerStream) CloseAndRecv() (*resourcepb.BulkResponse, error) {
	return s.response, s.closeErr
}

func TestBlobProducerNegotiation(t *testing.T) {
	for _, tc := range []struct {
		name          string
		headers       metadata.MD
		headerErr     error
		wait          bool
		wantMigration bool
	}{
		{name: "acknowledged", headers: metadata.Pairs(resourcepb.InlineBlobMetadataKey, "1"), wantMigration: true},
		{name: "old server sends no acknowledgement"},
		{name: "invalid acknowledgement", headers: metadata.Pairs(resourcepb.InlineBlobMetadataKey, "true")},
		{name: "duplicate acknowledgement", headers: metadata.Pairs(resourcepb.InlineBlobMetadataKey, "1", resourcepb.InlineBlobMetadataKey, "1")},
		{name: "header transport error", headerErr: errors.New("unavailable")},
		{name: "old server waits for body", wait: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				gr := schema.GroupResource{Group: "dashboard.grafana.app", Resource: "snapshots"}
				called := false
				registry := migrations.NewMigrationRegistry()
				registry.Register(migrations.MigrationDefinition{
					ID: "snapshots", RequiresInlineBlobs: true,
					Migrators: map[schema.GroupResource]migrations.MigratorFunc{
						gr: func(context.Context, int64, migrations.MigrateOptions, resourcepb.BulkStore_BulkProcessClient) error {
							called = true
							return nil
						},
					},
				})
				client := resource.NewMockResourceClient(t)
				migrator := migrations.ProvideUnifiedMigrator(client, registry)
				// A fresh handshake is required on every attempt, even after success.
				for range 2 {
					called = false
					stream := &blobProducerStream{headers: tc.headers, headerErr: tc.headerErr, waitForCancel: tc.wait, response: &resourcepb.BulkResponse{}}
					client.EXPECT().BulkProcess(mock.Anything).Run(func(ctx context.Context, _ ...grpc.CallOption) {
						stream.ctx = ctx
						md, _ := metadata.FromOutgoingContext(ctx)
						require.Equal(t, []string{"1"}, md.Get(resourcepb.InlineBlobMetadataKey))
					}).Return(stream, nil).Once()
					_, err := migrator.Migrate(t.Context(), migrations.MigrateOptions{Namespace: "default", Resources: []schema.GroupResource{gr}})
					if tc.wantMigration {
						require.NoError(t, err)
					} else {
						require.Error(t, err)
					}
					if tc.wait {
						require.ErrorIs(t, err, context.DeadlineExceeded)
					}
					if tc.headerErr != nil {
						require.ErrorIs(t, err, tc.headerErr)
					}
					require.Equal(t, 1, stream.headerCalls)
					require.Equal(t, tc.wantMigration, called)
					require.ErrorIs(t, stream.ctx.Err(), context.Canceled)
				}
			})
		})
	}
}

func TestMigrationBulkCompletionErrors(t *testing.T) {
	transportErr := errors.New("transport failed")
	for _, tc := range []struct {
		name     string
		response *resourcepb.BulkResponse
		err      error
		wantErr  string
	}{
		{name: "success", response: &resourcepb.BulkResponse{}},
		{name: "transport", err: transportErr, wantErr: "transport failed"},
		{name: "embedded", response: &resourcepb.BulkResponse{Error: &resourcepb.ErrorResult{Code: 500, Message: "publication failed"}}, wantErr: "publication failed"},
		{name: "transport takes precedence", response: &resourcepb.BulkResponse{Error: &resourcepb.ErrorResult{Code: 500, Message: "publication failed"}}, err: transportErr, wantErr: "transport failed"},
		{name: "missing completion", wantErr: "no completion response"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			gr := schema.GroupResource{Group: "test", Resource: "tests"}
			registry := migrations.NewMigrationRegistry()
			registry.Register(migrations.MigrationDefinition{ID: "test", Migrators: map[schema.GroupResource]migrations.MigratorFunc{
				gr: func(context.Context, int64, migrations.MigrateOptions, resourcepb.BulkStore_BulkProcessClient) error {
					return nil
				},
			}})
			stream := &blobProducerStream{response: tc.response, closeErr: tc.err}
			client := resource.NewMockResourceClient(t)
			client.EXPECT().BulkProcess(mock.Anything).Return(stream, nil)
			_, err := migrations.ProvideUnifiedMigrator(client, registry).Migrate(t.Context(), migrations.MigrateOptions{Namespace: "default", Resources: []schema.GroupResource{gr}})
			if tc.wantErr == "" {
				require.NoError(t, err)
			} else {
				require.ErrorContains(t, err, tc.wantErr)
			}
			if tc.err != nil {
				require.ErrorIs(t, err, tc.err)
			}
		})
	}
}
