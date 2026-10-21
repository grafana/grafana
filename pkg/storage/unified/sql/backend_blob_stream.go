package sql

import (
	"context"
	"io"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func (b *backend) streamingBlobAdapter() (resource.StreamingBlobSupport, error) {
	store, err := kv.NewSQLKV(b.db.SqlDB(), b.db.DriverName())
	if err != nil {
		return nil, err
	}
	return resource.NewKVBlobSupport(store).(resource.StreamingBlobSupport), nil
}

func (b *backend) PutResourceBlobStream(ctx context.Context, req *resourcepb.PutBlobRequest, reader io.Reader) (*resourcepb.PutBlobResponse, error) {
	store, err := b.streamingBlobAdapter()
	if err != nil {
		return nil, err
	}
	return store.PutResourceBlobStream(ctx, req, reader)
}

func (b *backend) GetResourceBlobStream(ctx context.Context, key *resourcepb.ResourceKey, info *utils.BlobInfo, open func(string) (io.Writer, error)) error {
	store, err := b.streamingBlobAdapter()
	if err != nil {
		return err
	}
	return store.GetResourceBlobStream(ctx, key, info, open)
}
