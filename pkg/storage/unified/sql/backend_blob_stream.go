package sql

import (
	"context"
	"errors"
	"io"
	"uuid"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func (b *backend) blobSQLStore() (*kv.SqlKV, error) {
	store, err := kv.NewSQLKV(b.db.SqlDB(), b.db.DriverName())
	if err != nil {
		return nil, err
	}
	return store.(*kv.SqlKV), nil
}

func (b *backend) PutResourceBlobStream(ctx context.Context, req *resourcepb.PutBlobRequest, reader io.Reader) (*resourcepb.PutBlobResponse, error) {
	store, err := b.blobSQLStore()
	if err != nil {
		return nil, err
	}
	info := &utils.BlobInfo{UID: uuid.NewV4().String()}
	info.SetContentType(req.ContentType)
	info.Size, info.Hash, err = store.SaveBlobStream(ctx, kv.BlobKey{
		Group: req.Resource.Group, Resource: req.Resource.Resource, Namespace: req.Resource.Namespace,
		Name: req.Resource.Name, UID: info.UID,
	}, req.ContentType, reader)
	if err != nil {
		return nil, err
	}
	return &resourcepb.PutBlobResponse{Uid: info.UID, Size: info.Size, Hash: info.Hash, MimeType: info.MimeType, Charset: info.Charset}, nil
}

func (b *backend) GetResourceBlobStream(ctx context.Context, key *resourcepb.ResourceKey, info *utils.BlobInfo, open func(string) (io.Writer, error)) error {
	store, err := b.blobSQLStore()
	if err != nil {
		return err
	}
	err = store.ReadBlobStream(ctx, kv.BlobKey{
		Group: key.Group, Resource: key.Resource, Namespace: key.Namespace, Name: key.Name, UID: info.UID,
	}, open)
	if errors.Is(err, kv.ErrNotFound) {
		return status.Error(codes.NotFound, "blob not found")
	}
	return err
}
