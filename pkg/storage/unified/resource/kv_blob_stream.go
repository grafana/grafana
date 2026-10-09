package resource

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

func (s *kvBlobSupport) PutResourceBlobStream(ctx context.Context, req *resourcepb.PutBlobRequest, reader io.Reader) (*resourcepb.PutBlobResponse, error) {
	store, ok := s.kv.(*kv.SqlKV)
	if !ok {
		return nil, status.Error(codes.Unimplemented, "streaming requires SQL-backed KV")
	}
	info := &utils.BlobInfo{UID: uuid.NewV4().String()}
	info.SetContentType(req.ContentType)
	var err error
	info.Size, info.Hash, err = store.SaveBlobStream(ctx, kvBlobKey(req.Resource, info.UID), req.ContentType, reader)
	if err != nil {
		return nil, err
	}
	return &resourcepb.PutBlobResponse{Uid: info.UID, Size: info.Size, Hash: info.Hash, MimeType: info.MimeType, Charset: info.Charset}, nil
}

func (s *kvBlobSupport) GetResourceBlobStream(ctx context.Context, key *resourcepb.ResourceKey, info *utils.BlobInfo, open func(string) (io.Writer, error)) error {
	store, ok := s.kv.(*kv.SqlKV)
	if !ok {
		return status.Error(codes.Unimplemented, "streaming requires SQL-backed KV")
	}
	err := store.ReadBlobStream(ctx, kvBlobKey(key, info.UID), open)
	if errors.Is(err, kv.ErrNotFound) {
		return status.Error(codes.NotFound, "blob not found")
	}
	return err
}
