package resources

import (
	"context"
	"time"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
)

// instrumentedReaderWriter wraps a repository.ReaderWriter so every operation
// against it is observed by metrics, regardless of which caller (job
// execution, the files API, the parser, the authorizer, sync compare/diff,
// ...) performs it. Instrumenting at this single seam — rather than at each
// caller — is what guarantees coverage: any new caller that receives the
// wrapped value gets metrics for free, with nothing to remember to wire up.
//
// Repositories also implement a handful of optional capability interfaces
// (repository.Versioned, repository.RepositoryWithURLs, ...) that callers
// downstream of the wrap point detect via type assertion (e.g. sync's
// incremental-vs-full decision asserts repository.Versioned on this exact
// value). Since Go embedding only promotes the methods of the *declared*
// field type, wrapping would silently drop those capabilities unless each
// one still in use past the wrap point is preserved explicitly below.
type instrumentedReaderWriter struct {
	repository.ReaderWriter
	metrics FileSizeRecorder
}

// WrapReaderWriter returns rw instrumented with metrics, preserving whichever
// of the optional capability interfaces rw already implements. If metrics is
// nil, rw is returned unwrapped.
func WrapReaderWriter(rw repository.ReaderWriter, metrics FileSizeRecorder) repository.ReaderWriter {
	if metrics == nil {
		return rw
	}
	base := instrumentedReaderWriter{ReaderWriter: rw, metrics: metrics}

	versioned, isVersioned := rw.(repository.Versioned)
	urls, hasURLs := rw.(repository.RepositoryWithURLs)

	switch {
	case isVersioned && hasURLs:
		return &instrumentedVersionedURLReaderWriter{
			instrumentedVersionedReaderWriter: instrumentedVersionedReaderWriter{instrumentedReaderWriter: base, Versioned: versioned},
			urls:                              urls,
		}
	case isVersioned:
		return &instrumentedVersionedReaderWriter{instrumentedReaderWriter: base, Versioned: versioned}
	case hasURLs:
		return &instrumentedURLReaderWriter{instrumentedReaderWriter: base, urls: urls}
	default:
		return &base
	}
}

func (i *instrumentedReaderWriter) Read(ctx context.Context, path, ref string) (*repository.FileInfo, error) {
	start := time.Now()
	info, err := i.ReaderWriter.Read(ctx, path, ref)
	size := 0
	if info != nil {
		size = len(info.Data)
	}
	i.metrics.RecordFileRead(size, time.Since(start), err)
	return info, err
}

func (i *instrumentedReaderWriter) ReadTree(ctx context.Context, ref string) ([]repository.FileTreeEntry, error) {
	start := time.Now()
	entries, err := i.ReaderWriter.ReadTree(ctx, ref)
	i.metrics.RecordOperation("list", time.Since(start), err)
	return entries, err
}

func (i *instrumentedReaderWriter) Create(ctx context.Context, path, ref string, data []byte, message string) error {
	start := time.Now()
	err := i.ReaderWriter.Create(ctx, path, ref, data, message)
	i.metrics.RecordFileWrite(len(data), time.Since(start), err)
	return err
}

func (i *instrumentedReaderWriter) Update(ctx context.Context, path, ref string, data []byte, message string) error {
	start := time.Now()
	err := i.ReaderWriter.Update(ctx, path, ref, data, message)
	i.metrics.RecordFileWrite(len(data), time.Since(start), err)
	return err
}

func (i *instrumentedReaderWriter) Write(ctx context.Context, path, ref string, data []byte, message string) error {
	start := time.Now()
	err := i.ReaderWriter.Write(ctx, path, ref, data, message)
	i.metrics.RecordFileWrite(len(data), time.Since(start), err)
	return err
}

func (i *instrumentedReaderWriter) Delete(ctx context.Context, path, ref, message string) error {
	start := time.Now()
	err := i.ReaderWriter.Delete(ctx, path, ref, message)
	i.metrics.RecordOperation("delete", time.Since(start), err)
	return err
}

func (i *instrumentedReaderWriter) Move(ctx context.Context, oldPath, newPath, ref, message string) error {
	start := time.Now()
	err := i.ReaderWriter.Move(ctx, oldPath, newPath, ref, message)
	i.metrics.RecordOperation("move", time.Since(start), err)
	return err
}

// WithMaxFileSize forwards to the inner value if it supports per-read size
// limiting, so the wrapper itself satisfies repository.SizeLimitedReader —
// callers check for this optional interface on the same reference right
// after obtaining it, which is also where wrapping happens.
func (i *instrumentedReaderWriter) WithMaxFileSize(maxBytes int64) {
	if m, ok := i.ReaderWriter.(repository.SizeLimitedReader); ok {
		m.WithMaxFileSize(maxBytes)
	}
}

// instrumentedVersionedReaderWriter additionally preserves repository.Versioned
// via embedding. Versioned does not declare Config/Test, so embedding it
// alongside the ReaderWriter-derived base (which does, via repository.Repository)
// introduces no ambiguous selectors.
type instrumentedVersionedReaderWriter struct {
	instrumentedReaderWriter
	repository.Versioned
}

// instrumentedURLReaderWriter additionally preserves repository.RepositoryWithURLs.
// Unlike Versioned, RepositoryWithURLs embeds repository.Repository itself, so
// embedding it directly would collide with the Config/Test already promoted
// from the ReaderWriter-derived base — instead its two distinct methods are
// forwarded explicitly.
type instrumentedURLReaderWriter struct {
	instrumentedReaderWriter
	urls repository.RepositoryWithURLs
}

func (i *instrumentedURLReaderWriter) ResourceURLs(ctx context.Context, file *repository.FileInfo) (*provisioning.RepositoryURLs, error) {
	return i.urls.ResourceURLs(ctx, file)
}

func (i *instrumentedURLReaderWriter) RefURLs(ctx context.Context, ref string) (*provisioning.RepositoryURLs, error) {
	return i.urls.RefURLs(ctx, ref)
}

type instrumentedVersionedURLReaderWriter struct {
	instrumentedVersionedReaderWriter
	urls repository.RepositoryWithURLs
}

func (i *instrumentedVersionedURLReaderWriter) ResourceURLs(ctx context.Context, file *repository.FileInfo) (*provisioning.RepositoryURLs, error) {
	return i.urls.ResourceURLs(ctx, file)
}

func (i *instrumentedVersionedURLReaderWriter) RefURLs(ctx context.Context, ref string) (*provisioning.RepositoryURLs, error) {
	return i.urls.RefURLs(ctx, ref)
}

var (
	_ repository.ReaderWriter       = (*instrumentedReaderWriter)(nil)
	_ repository.SizeLimitedReader  = (*instrumentedReaderWriter)(nil)
	_ repository.Versioned          = (*instrumentedVersionedReaderWriter)(nil)
	_ repository.RepositoryWithURLs = (*instrumentedURLReaderWriter)(nil)
	_ repository.Versioned          = (*instrumentedVersionedURLReaderWriter)(nil)
	_ repository.RepositoryWithURLs = (*instrumentedVersionedURLReaderWriter)(nil)
)
