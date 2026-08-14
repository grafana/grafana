package resource

import (
	"context"
	"io"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
	"gocloud.dev/blob"
)

// CDKBucket is an abstraction that provides the same functionality as gocloud.dev/blob.Bucket
// It can be used to wrap gocloud.dev/blob.Bucket with some useful things as o11y.
type CDKBucket interface {
	Attributes(context.Context, string) (*blob.Attributes, error)
	List(*blob.ListOptions) *blob.ListIterator
	ListPage(context.Context, []byte, int, *blob.ListOptions) ([]*blob.ListObject, []byte, error)
	WriteAll(context.Context, string, []byte, *blob.WriterOptions) error
	ReadAll(context.Context, string) ([]byte, error)
	Delete(context.Context, string) error
	SignedURL(context.Context, string, *blob.SignedURLOptions) (string, error)
	Upload(context.Context, string, io.Reader, *blob.WriterOptions) error
	Download(context.Context, string, io.Writer, *blob.ReaderOptions) error
}

var _ CDKBucket = (*blob.Bucket)(nil)
var _ CDKBucket = (*InstrumentedBucket)(nil)

const (
	cdkBucketOperationLabel = "operation"
	cdkBucketStatusLabel    = "status"
	cdkBucketStatusSuccess  = "success"
	cdkBucketStatusError    = "error"
)

type InstrumentedBucket struct {
	latency *prometheus.HistogramVec
	bucket  CDKBucket
}

func NewInstrumentedBucket(bucket CDKBucket, reg prometheus.Registerer) *InstrumentedBucket {
	b := &InstrumentedBucket{
		bucket: bucket,
		latency: promauto.With(reg).NewHistogramVec(prometheus.HistogramOpts{
			Name:    "cdk_blobstorage_latency_seconds",
			Buckets: prometheus.ExponentialBuckets(0.008, 4, 7),
		}, []string{cdkBucketOperationLabel, cdkBucketStatusLabel}),
	}
	return b
}

// observe records latency and, on error, marks the span as failed.
func (b *InstrumentedBucket) observe(span trace.Span, operation string, duration float64, err error) {
	status := cdkBucketStatusSuccess
	if err != nil {
		status = cdkBucketStatusError
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
	}
	b.latency.WithLabelValues(operation, status).Observe(duration)
}

func (b *InstrumentedBucket) Attributes(ctx context.Context, key string) (*blob.Attributes, error) {
	ctx, span := tracer.Start(ctx, "resource.InstrumentedBucket.Attributes")
	defer span.End()
	start := time.Now()
	retVal, err := b.bucket.Attributes(ctx, key)
	b.observe(span, "Attributes", time.Since(start).Seconds(), err)
	return retVal, err
}

func (b *InstrumentedBucket) List(opts *blob.ListOptions) *blob.ListIterator {
	// List just returns an iterator struct based on the provided options. No need for extended telemetry.
	return b.bucket.List(opts)
}

func (b *InstrumentedBucket) ListPage(ctx context.Context, pageToken []byte, pageSize int, opts *blob.ListOptions) ([]*blob.ListObject, []byte, error) {
	ctx, span := tracer.Start(ctx, "resource.InstrumentedBucket.ListPage")
	defer span.End()
	start := time.Now()
	retVal, nextPageToken, err := b.bucket.ListPage(ctx, pageToken, pageSize, opts)
	b.observe(span, "ListPage", time.Since(start).Seconds(), err)
	return retVal, nextPageToken, err
}

func (b *InstrumentedBucket) ReadAll(ctx context.Context, key string) ([]byte, error) {
	ctx, span := tracer.Start(ctx, "resource.InstrumentedBucket.ReadAll")
	defer span.End()
	start := time.Now()
	retVal, err := b.bucket.ReadAll(ctx, key)
	b.observe(span, "ReadAll", time.Since(start).Seconds(), err)
	return retVal, err
}

func (b *InstrumentedBucket) WriteAll(ctx context.Context, key string, p []byte, opts *blob.WriterOptions) error {
	ctx, span := tracer.Start(ctx, "resource.InstrumentedBucket.WriteAll")
	defer span.End()
	start := time.Now()
	err := b.bucket.WriteAll(ctx, key, p, opts)
	b.observe(span, "WriteAll", time.Since(start).Seconds(), err)
	return err
}

func (b *InstrumentedBucket) Delete(ctx context.Context, key string) error {
	ctx, span := tracer.Start(ctx, "resource.InstrumentedBucket.Delete")
	defer span.End()
	start := time.Now()
	err := b.bucket.Delete(ctx, key)
	b.observe(span, "Delete", time.Since(start).Seconds(), err)
	return err
}

func (b *InstrumentedBucket) Upload(ctx context.Context, key string, r io.Reader, opts *blob.WriterOptions) error {
	ctx, span := tracer.Start(ctx, "resource.InstrumentedBucket.Upload")
	defer span.End()
	start := time.Now()
	err := b.bucket.Upload(ctx, key, r, opts)
	b.observe(span, "Upload", time.Since(start).Seconds(), err)
	return err
}

func (b *InstrumentedBucket) Download(ctx context.Context, key string, w io.Writer, opts *blob.ReaderOptions) error {
	ctx, span := tracer.Start(ctx, "resource.InstrumentedBucket.Download")
	defer span.End()
	start := time.Now()
	err := b.bucket.Download(ctx, key, w, opts)
	b.observe(span, "Download", time.Since(start).Seconds(), err)
	return err
}

func (b *InstrumentedBucket) SignedURL(ctx context.Context, key string, opts *blob.SignedURLOptions) (string, error) {
	ctx, span := tracer.Start(ctx, "resource.InstrumentedBucket.SignedURL")
	defer span.End()
	start := time.Now()
	retVal, err := b.bucket.SignedURL(ctx, key, opts)
	b.observe(span, "SignedURL", time.Since(start).Seconds(), err)
	return retVal, err
}
