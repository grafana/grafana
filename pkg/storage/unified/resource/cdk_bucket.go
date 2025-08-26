package resource

import (
	"context"
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
	requests *prometheus.CounterVec
	latency  *prometheus.HistogramVec
	tracer   trace.Tracer
	bucket   CDKBucket
}

func NewInstrumentedBucket(bucket CDKBucket, reg prometheus.Registerer, tracer trace.Tracer) *InstrumentedBucket {
	b := &InstrumentedBucket{
		bucket: bucket,
		tracer: tracer,
	}
	b.initMetrics(reg)
	return b
}

func (b *InstrumentedBucket) initMetrics(reg prometheus.Registerer) {
	b.requests = promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
		Name: "cdk_blobstorage_requests_total",
	}, []string{
		cdkBucketOperationLabel,
		cdkBucketStatusLabel,
	})
	b.latency = promauto.With(reg).NewHistogramVec(prometheus.HistogramOpts{
		Name:    "cdk_blobstorage_latency_seconds",
		Buckets: prometheus.ExponentialBuckets(0.008, 4, 7),
	}, []string{
		cdkBucketOperationLabel,
		cdkBucketStatusLabel,
	})
}

func (b *InstrumentedBucket) Attributes(ctx context.Context, key string) (*blob.Attributes, error) {
	ctx, span := b.tracer.Start(ctx, "InstrumentedBucket/Attributes")
	defer span.End()
	start := time.Now()
	retVal, err := b.bucket.Attributes(ctx, key)
	end := time.Since(start).Seconds()
	labels := prometheus.Labels{
		cdkBucketOperationLabel: "Attributes",
	}
	if err != nil {
		labels[cdkBucketStatusLabel] = cdkBucketStatusError
		b.requests.With(labels).Inc()
		b.latency.With(labels).Observe(end)
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return retVal, err
	}
	labels[cdkBucketStatusLabel] = cdkBucketStatusSuccess
	b.requests.With(labels).Inc()
	b.latency.With(labels).Observe(end)
	return retVal, err
}

func (b *InstrumentedBucket) List(opts *blob.ListOptions) *blob.ListIterator {
	// List just returns an iterator struct based on the provided options. No need for extended telemetry.
	return b.bucket.List(opts)
}

func (b *InstrumentedBucket) ListPage(ctx context.Context, pageToken []byte, pageSize int, opts *blob.ListOptions) ([]*blob.ListObject, []byte, error) {
	ctx, span := b.tracer.Start(ctx, "InstrumentedBucket/ListPage")
	defer span.End()
	start := time.Now()
	retVal, nextPageToken, err := b.bucket.ListPage(ctx, pageToken, pageSize, opts)
	end := time.Since(start).Seconds()
	labels := prometheus.Labels{
		cdkBucketOperationLabel: "ListPage",
	}
	if err != nil {
		labels[cdkBucketStatusLabel] = cdkBucketStatusError
		b.latency.With(labels).Observe(end)
		b.requests.With(labels).Inc()
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return retVal, nextPageToken, err
	}
	labels[cdkBucketStatusLabel] = cdkBucketStatusSuccess
	b.requests.With(labels).Inc()
	return retVal, nextPageToken, err
}

func (b *InstrumentedBucket) ReadAll(ctx context.Context, key string) ([]byte, error) {
	ctx, span := b.tracer.Start(ctx, "InstrumentedBucket/ReadAll")
	defer span.End()
	start := time.Now()
	retVal, err := b.bucket.ReadAll(ctx, key)
	end := time.Since(start).Seconds()
	labels := prometheus.Labels{
		cdkBucketOperationLabel: "ReadAll",
	}
	if err != nil {
		labels[cdkBucketStatusLabel] = cdkBucketStatusError
		b.requests.With(labels).Inc()
		b.latency.With(labels).Observe(end)
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return retVal, err
	}
	labels[cdkBucketStatusLabel] = cdkBucketStatusSuccess
	b.requests.With(labels).Inc()
	b.latency.With(labels).Observe(end)
	return retVal, err
}

func (b *InstrumentedBucket) WriteAll(ctx context.Context, key string, p []byte, opts *blob.WriterOptions) error {
	ctx, span := b.tracer.Start(ctx, "InstrumentedBucket/WriteAll")
	defer span.End()
	start := time.Now()
	err := b.bucket.WriteAll(ctx, key, p, opts)
	end := time.Since(start).Seconds()
	labels := prometheus.Labels{
		cdkBucketOperationLabel: "WriteAll",
	}
	if err != nil {
		labels[cdkBucketStatusLabel] = cdkBucketStatusError
		b.requests.With(labels).Inc()
		b.latency.With(labels).Observe(end)
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return err
	}
	labels[cdkBucketStatusLabel] = cdkBucketStatusSuccess
	b.requests.With(labels).Inc()
	b.latency.With(labels).Observe(end)
	return err
}

func (b *InstrumentedBucket) Delete(ctx context.Context, key string) error {
	ctx, span := b.tracer.Start(ctx, "InstrumentedBucket/Delete")
	defer span.End()
	start := time.Now()
	err := b.bucket.Delete(ctx, key)
	end := time.Since(start).Seconds()
	labels := prometheus.Labels{
		cdkBucketOperationLabel: "Delete",
	}
	if err != nil {
		labels[cdkBucketStatusLabel] = cdkBucketStatusError
		b.requests.With(labels).Inc()
		b.latency.With(labels).Observe(end)
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return err
	}
	labels[cdkBucketStatusLabel] = cdkBucketStatusSuccess
	b.requests.With(labels).Inc()
	b.latency.With(labels).Observe(end)
	return nil
}

func (b *InstrumentedBucket) SignedURL(ctx context.Context, key string, opts *blob.SignedURLOptions) (string, error) {
	ctx, span := b.tracer.Start(ctx, "InstrumentedBucket/SignedURL")
	defer span.End()
	start := time.Now()
	retVal, err := b.bucket.SignedURL(ctx, key, opts)
	end := time.Since(start).Seconds()
	labels := prometheus.Labels{
		cdkBucketOperationLabel: "SignedURL",
	}
	if err != nil {
		labels[cdkBucketStatusLabel] = cdkBucketStatusError
		b.requests.With(labels).Inc()
		b.latency.With(labels).Observe(end)
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return retVal, err
	}
	labels[cdkBucketStatusLabel] = cdkBucketStatusSuccess
	b.requests.With(labels).Inc()
	b.latency.With(labels).Observe(end)
	return retVal, err
}
