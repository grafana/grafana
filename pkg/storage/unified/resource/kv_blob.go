package resource

import (
	"context"
	"crypto/md5"
	"encoding/hex"
	"errors"
	"net/http"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

var _ BlobSupport = (*kvBlobSupport)(nil)

type kvBlobSupport struct {
	kv kv.KV
}

func NewKVBlobSupport(store kv.KV) BlobSupport {
	return &kvBlobSupport{kv: store}
}

func kvBlobKey(key *resourcepb.ResourceKey, uid string) kv.BlobKey {
	return kv.BlobKey{
		Group:     key.Group,
		Resource:  key.Resource,
		Namespace: key.Namespace,
		Name:      key.Name,
		UID:       uid,
	}
}

func (s *kvBlobSupport) SupportsSignedURLs() bool {
	return false
}

func (s *kvBlobSupport) PutResourceBlob(ctx context.Context, req *resourcepb.PutBlobRequest) (*resourcepb.PutBlobResponse, error) {
	if req.Method == resourcepb.PutBlobRequest_HTTP {
		return nil, GRPCStatusError(&resourcepb.ErrorResult{
			Message: "signed url upload not supported",
			Code:    http.StatusNotImplemented,
		})
	}
	if len(req.Value) == 0 {
		return nil, GRPCStatusError(NewBadRequestError("empty content"))
	}

	hash := md5.Sum(req.Value) // #nosec G401 nosemgrep: go.lang.security.audit.crypto.use_of_weak_crypto.use-of-md5
	info := &utils.BlobInfo{
		UID:  NewBlobUID(),
		Size: int64(len(req.Value)),
		Hash: hex.EncodeToString(hash[:]),
	}
	info.SetContentType(req.ContentType)

	w, err := s.kv.Save(ctx, kv.BlobDataSection, kvBlobKey(req.Resource, info.UID).String())
	if err != nil {
		return nil, rpcErrorFrom(err)
	}
	for _, part := range [][]byte{kv.EncodeBlobValueHeader(req.ContentType), req.Value} {
		if _, err := w.Write(part); err != nil {
			_ = w.Close()
			return nil, rpcErrorFrom(err)
		}
	}
	if err := w.Close(); err != nil {
		return nil, rpcErrorFrom(err)
	}

	return &resourcepb.PutBlobResponse{
		Uid:      info.UID,
		Size:     info.Size,
		MimeType: info.MimeType,
		Charset:  info.Charset,
		Hash:     info.Hash,
	}, nil
}

func (s *kvBlobSupport) GetResourceBlob(ctx context.Context, key *resourcepb.ResourceKey, info *utils.BlobInfo, _ bool) (*resourcepb.GetBlobResponse, error) {
	if info == nil || info.UID == "" {
		return nil, GRPCStatusError(NewBadRequestError("missing blob uid"))
	}
	r, err := s.kv.Get(ctx, kv.BlobDataSection, kvBlobKey(key, info.UID).String())
	if errors.Is(err, kv.ErrNotFound) {
		return nil, GRPCStatusError(&resourcepb.ErrorResult{Code: http.StatusNotFound})
	}
	if err != nil {
		return nil, rpcErrorFrom(err)
	}
	value, err := kv.ReadAllAndClose(r)
	if err != nil {
		return nil, rpcErrorFrom(err)
	}
	contentType, body, err := kv.DecodeBlobValue(value)
	if err != nil {
		return nil, rpcErrorFrom(err)
	}
	return &resourcepb.GetBlobResponse{Value: body, ContentType: contentType}, nil
}
