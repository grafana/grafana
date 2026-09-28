package repository

import (
	"context"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

// sizeLimitedReaderWriter wraps a ReaderWriter and rejects reads that exceed
// maxBytes. The check fires immediately after the underlying repository
// returns the file bytes, so callers (including parsers and sync workers)
// never see oversized payloads.
type sizeLimitedReaderWriter struct {
	ReaderWriter
	maxBytes int64
}

// sizeLimitedVersionedReaderWriter mirrors sizeLimitedReaderWriter but also
// satisfies Versioned, so wrapping a versioned repository does not strip the
// interface from downstream callers (e.g. the sync worker, which falls back
// to full sync when the repo no longer reports as Versioned).
type sizeLimitedVersionedReaderWriter struct {
	sizeLimitedReaderWriter
	Versioned
}

// NewSizeLimitedReaderWriter wraps rw so its Read method enforces the given
// byte cap. The wrapper preserves the Versioned interface when the inner
// repository implements it. When maxBytes <= 0 the original rw is returned
// unchanged.
func NewSizeLimitedReaderWriter(rw ReaderWriter, maxBytes int64) ReaderWriter {
	if maxBytes <= 0 {
		return rw
	}
	limitedRw := sizeLimitedReaderWriter{ReaderWriter: rw, maxBytes: maxBytes}
	if v, ok := rw.(Versioned); ok {
		return &sizeLimitedVersionedReaderWriter{sizeLimitedReaderWriter: limitedRw, Versioned: v}
	}
	return &limitedRw
}

func (s *sizeLimitedReaderWriter) Read(ctx context.Context, path, ref string) (*FileInfo, error) {
	info, err := s.ReaderWriter.Read(ctx, path, ref)
	if err != nil {
		return info, err
	}
	if info != nil && int64(len(info.Data)) > s.maxBytes {
		return nil, apierrors.NewRequestEntityTooLargeError(
			fmt.Sprintf("file %q is %d bytes; max allowed is %d bytes", info.Path, len(info.Data), s.maxBytes),
		)
	}
	return info, nil
}
