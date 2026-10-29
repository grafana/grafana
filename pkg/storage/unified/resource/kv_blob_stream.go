package resource

import (
	"bufio"
	"context"
	"crypto/md5"
	"encoding/binary"
	"encoding/hex"
	"errors"
	"fmt"
	"io"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

const maxKVBlobContentTypeBytes = 8 << 10

func (s *kvBlobSupport) PutResourceBlobStream(ctx context.Context, req *resourcepb.PutBlobRequest, reader io.Reader) (*resourcepb.PutBlobResponse, error) {
	store, ok := s.kv.(*kv.SqlKV)
	if !ok {
		return s.putKVBlobStream(ctx, req, reader)
	}
	info := &utils.BlobInfo{UID: NewBlobUID()}
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
		return s.getKVBlobStream(ctx, key, info, open)
	}
	err := store.ReadBlobStream(ctx, kvBlobKey(key, info.UID), open)
	if errors.Is(err, kv.ErrNotFound) {
		return status.Error(codes.NotFound, "blob not found")
	}
	return err
}

func (s *kvBlobSupport) putKVBlobStream(ctx context.Context, req *resourcepb.PutBlobRequest, reader io.Reader) (*resourcepb.PutBlobResponse, error) {
	if len(req.ContentType) > maxKVBlobContentTypeBytes {
		return nil, status.Error(codes.InvalidArgument, "blob content type too long")
	}
	info := &utils.BlobInfo{UID: NewBlobUID()}
	info.SetContentType(req.ContentType)
	writeCtx, cancel := context.WithCancel(ctx)
	defer cancel()
	w, err := s.kv.Save(writeCtx, kv.BlobDataSection, kvBlobKey(req.Resource, info.UID).String())
	if err != nil {
		return nil, err
	}
	closed := false
	defer func() {
		// Close commits KV writers; cancellation must precede cleanup on a
		// source failure, including one received after some chunks persisted.
		cancel()
		if !closed {
			_ = w.Close()
		}
	}()
	if _, err := w.Write(kv.EncodeBlobValueHeader(req.ContentType)); err != nil {
		return nil, err
	}
	digest := md5.New() // #nosec G401 nosemgrep: go.lang.security.audit.crypto.use_of_weak_crypto.use-of-md5
	size, err := io.CopyBuffer(io.MultiWriter(w, digest), io.LimitReader(reader, blobStreamMaxSize+1), make([]byte, blobStreamChunkSize))
	if err != nil {
		return nil, err
	}
	if size == 0 || size > blobStreamMaxSize {
		return nil, status.Error(codes.InvalidArgument, "empty or oversized blob")
	}
	closed = true
	if err := w.Close(); err != nil {
		return nil, err
	}
	return &resourcepb.PutBlobResponse{Uid: info.UID, Size: size, Hash: hex.EncodeToString(digest.Sum(nil)), MimeType: info.MimeType, Charset: info.Charset}, nil
}

func (s *kvBlobSupport) getKVBlobStream(ctx context.Context, key *resourcepb.ResourceKey, info *utils.BlobInfo, open func(string) (io.Writer, error)) (err error) {
	if info == nil || info.UID == "" {
		return status.Error(codes.InvalidArgument, "missing blob uid")
	}
	r, err := s.kv.Get(ctx, kv.BlobDataSection, kvBlobKey(key, info.UID).String())
	if errors.Is(err, kv.ErrNotFound) {
		return status.Error(codes.NotFound, "blob not found")
	}
	if err != nil {
		return err
	}
	defer func() { err = errors.Join(err, r.Close()) }()
	buffered := bufio.NewReaderSize(r, blobStreamChunkSize)
	version, err := buffered.ReadByte()
	if err != nil {
		return err
	}
	if version != kv.EncodeBlobValueHeader("")[0] {
		return fmt.Errorf("unsupported blob value version %d", version)
	}
	size, err := binary.ReadUvarint(buffered)
	if err != nil {
		return err
	}
	if size > maxKVBlobContentTypeBytes {
		return fmt.Errorf("blob content type too long")
	}
	contentType := make([]byte, int(size))
	if _, err := io.ReadFull(buffered, contentType); err != nil {
		return err
	}
	w, err := open(string(contentType))
	if err != nil {
		return err
	}
	n, err := io.CopyBuffer(w, io.LimitReader(buffered, blobStreamMaxSize+1), make([]byte, blobStreamChunkSize))
	if err != nil {
		return err
	}
	if n > blobStreamMaxSize {
		return fmt.Errorf("blob exceeds maximum size")
	}
	return nil
}
