package resource

import (
	"context"
	"crypto/md5"
	"encoding/hex"
	"io"
	"time"

	"gocloud.dev/blob"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

var _ StreamingBlobSupport = (*cdkBlobSupport)(nil)

func (s *cdkBlobSupport) PutResourceBlobStream(ctx context.Context, req *resourcepb.PutBlobRequest, reader io.Reader) (*resourcepb.PutBlobResponse, error) {
	info := &utils.BlobInfo{UID: NewBlobUID()}
	info.SetContentType(req.ContentType)
	path, err := s.getBlobPath(req.Resource, info)
	if err != nil {
		return nil, err
	}

	hash := md5.New() // #nosec G401 nosemgrep: go.lang.security.audit.crypto.use_of_weak_crypto.use-of-md5
	counted := &countingReader{reader: io.TeeReader(reader, hash)}
	if err := s.bucket.Upload(ctx, path, counted, &blob.WriterOptions{ContentType: req.ContentType}); err != nil {
		// An interrupted remote upload may have created an object. Its UID is not returned to the caller.
		cleanupCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
		defer cancel()
		_ = s.bucket.Delete(cleanupCtx, path)
		return nil, err
	}

	return &resourcepb.PutBlobResponse{
		Uid:      info.UID,
		Size:     counted.size,
		Hash:     hex.EncodeToString(hash.Sum(nil)),
		MimeType: info.MimeType,
		Charset:  info.Charset,
	}, nil
}

func (s *cdkBlobSupport) GetResourceBlobStream(ctx context.Context, key *resourcepb.ResourceKey, info *utils.BlobInfo, open func(string) (io.Writer, error)) error {
	path, err := s.getBlobPath(key, info)
	if err != nil {
		return err
	}
	// Check existence before sending the response metadata; a missing object should not start a stream.
	if _, err := s.bucket.Attributes(ctx, path); err != nil {
		return err
	}
	writer, err := open(info.ContentType())
	if err != nil {
		return err
	}
	return s.bucket.Download(ctx, path, writer, nil)
}

type countingReader struct {
	reader io.Reader
	size   int64
}

func (r *countingReader) Read(p []byte) (int, error) {
	n, err := r.reader.Read(p)
	r.size += int64(n)
	return n, err
}
