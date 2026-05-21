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

// Combo wrappers preserve optional interfaces that downstream code discovers
// via type assertion (same pattern as net/http middleware preserving Flusher/Hijacker).
type sizeLimitedVersionedReaderWriter struct {
	sizeLimitedReaderWriter
	Versioned
}

type sizeLimitedURLsReaderWriter struct {
	sizeLimitedReaderWriter
	RepositoryWithURLs
}

type sizeLimitedVersionedURLsReaderWriter struct {
	sizeLimitedReaderWriter
	Versioned
	RepositoryWithURLs
}

// NewSizeLimitedReaderWriter wraps rw so its Read method enforces the given
// byte cap. The wrapper preserves Versioned and RepositoryWithURLs interfaces
// when the inner repository implements them. When maxBytes <= 0 the original
// rw is returned unchanged.
func NewSizeLimitedReaderWriter(rw ReaderWriter, maxBytes int64) ReaderWriter {
	if maxBytes <= 0 {
		return rw
	}
	base := sizeLimitedReaderWriter{ReaderWriter: rw, maxBytes: maxBytes}
	v, isVersioned := rw.(Versioned)
	u, isURLs := rw.(RepositoryWithURLs)

	switch {
	case isVersioned && isURLs:
		return &sizeLimitedVersionedURLsReaderWriter{base, v, u}
	case isVersioned:
		return &sizeLimitedVersionedReaderWriter{base, v}
	case isURLs:
		return &sizeLimitedURLsReaderWriter{base, u}
	default:
		return &base
	}
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
