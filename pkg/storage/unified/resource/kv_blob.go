package resource

import (
	"context"
	"crypto/md5"
	"encoding/hex"
	"errors"
	"io"
	"net/http"
	"uuid"

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

func kvBlobKey(key *resourcepb.ResourceKey, uid, contentType string) kv.BlobKey {
	return kv.BlobKey{
		Group:       key.Group,
		Resource:    key.Resource,
		Namespace:   key.Namespace,
		Name:        key.Name,
		UID:         uid,
		ContentType: contentType,
	}
}

func (s *kvBlobSupport) findBlobKey(ctx context.Context, key *resourcepb.ResourceKey, uid string) (kv.BlobKey, error) {
	prefix := kvBlobKey(key, uid, "").UIDPrefix()
	for found, err := range s.kv.Keys(ctx, kv.BlobDataSection, kv.ListOptions{
		StartKey: prefix,
		EndKey:   kv.PrefixRangeEnd(prefix),
		Limit:    1,
	}) {
		if err != nil {
			return kv.BlobKey{}, err
		}
		return kv.ParseBlobKey(found)
	}
	return kv.BlobKey{}, kv.ErrNotFound
}

func (s *kvBlobSupport) SupportsSignedURLs() bool {
	return false
}

func (s *kvBlobSupport) PutResourceBlob(ctx context.Context, req *resourcepb.PutBlobRequest) (*resourcepb.PutBlobResponse, error) {
	if req.Method == resourcepb.PutBlobRequest_HTTP {
		return &resourcepb.PutBlobResponse{Error: &resourcepb.ErrorResult{
			Message: "signed url upload not supported",
			Code:    http.StatusNotImplemented,
		}}, nil
	}
	if len(req.Value) == 0 {
		return &resourcepb.PutBlobResponse{Error: NewBadRequestError("empty content")}, nil
	}

	hash := md5.Sum(req.Value) // #nosec G401 nosemgrep: go.lang.security.audit.crypto.use_of_weak_crypto.use-of-md5
	info := &utils.BlobInfo{
		UID:  uuid.NewV4().String(),
		Size: int64(len(req.Value)),
		Hash: hex.EncodeToString(hash[:]),
	}
	info.SetContentType(req.ContentType)

	w, err := s.kv.Save(ctx, kv.BlobDataSection, kvBlobKey(req.Resource, info.UID, info.ContentType()).String())
	if err != nil {
		return &resourcepb.PutBlobResponse{Error: AsErrorResult(err)}, nil
	}
	if _, err := w.Write(req.Value); err != nil {
		_ = w.Close()
		return &resourcepb.PutBlobResponse{Error: AsErrorResult(err)}, nil
	}
	if err := w.Close(); err != nil {
		return &resourcepb.PutBlobResponse{Error: AsErrorResult(err)}, nil
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
		return &resourcepb.GetBlobResponse{Error: NewBadRequestError("missing blob uid")}, nil
	}
	notFound := &resourcepb.GetBlobResponse{Error: &resourcepb.ErrorResult{Code: http.StatusNotFound}}
	blobKey, err := s.findBlobKey(ctx, key, info.UID)
	if errors.Is(err, kv.ErrNotFound) {
		return notFound, nil
	}
	if err != nil {
		return &resourcepb.GetBlobResponse{Error: AsErrorResult(err)}, nil
	}
	r, err := s.kv.Get(ctx, kv.BlobDataSection, blobKey.String())
	if errors.Is(err, kv.ErrNotFound) {
		return notFound, nil
	}
	if err != nil {
		return &resourcepb.GetBlobResponse{Error: AsErrorResult(err)}, nil
	}
	defer func() { _ = r.Close() }()
	value, err := io.ReadAll(r)
	if err != nil {
		return &resourcepb.GetBlobResponse{Error: AsErrorResult(err)}, nil
	}
	return &resourcepb.GetBlobResponse{Value: value, ContentType: blobKey.ContentType}, nil
}
