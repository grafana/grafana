package resource

import (
	"context"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
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
	SignedURL(context.Context, string, *blob.SignedURLOptions) (string, error)
}

var _ CDKBucket = (*blob.Bucket)(nil)

const (
	cdkBucketOperationLabel = "operation"
	cdkBucketStatusLabel    = "status"
	cdkBucketStatusSuccess  = "success"
	cdkBucketStatusError    = "error"
)

type InstrumentedBucket struct {
	requests *prometheus.CounterVec
	latency  *prometheus.HistogramVec
	bucket   CDKBucket
}

func NewInstrumentedBucket(bucket CDKBucket, reg prometheus.Registerer) *InstrumentedBucket {
	b := &InstrumentedBucket{
		bucket: bucket,
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
		Name: "cdk_blobstorage_latency_seconds",
	}, []string{
		cdkBucketOperationLabel,
		cdkBucketStatusLabel,
	})
}

func (b *InstrumentedBucket) Attributes(ctx context.Context, key string) (*blob.Attributes, error) {
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
		return retVal, err
	}
	labels[cdkBucketStatusLabel] = cdkBucketStatusSuccess
	b.requests.With(labels).Inc()
	b.latency.With(labels).Observe(end)
	return retVal, err
}

func (b *InstrumentedBucket) List(opts *blob.ListOptions) *blob.ListIterator {
	start := time.Now()
	iterator := b.bucket.List(opts)
	end := time.Since(start).Seconds()
	labels := prometheus.Labels{
		cdkBucketOperationLabel: "List",
		cdkBucketStatusLabel:    cdkBucketStatusSuccess,
	}
	b.requests.With(labels).Inc()
	b.latency.With(labels).Observe(end)
	return iterator
}

func (b *InstrumentedBucket) ListPage(ctx context.Context, pageToken []byte, pageSize int, opts *blob.ListOptions) ([]*blob.ListObject, []byte, error) {
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
		return retVal, nextPageToken, err
	}
	labels[cdkBucketStatusLabel] = cdkBucketStatusSuccess
	b.requests.With(labels).Inc()
	return retVal, nextPageToken, err
}

func (b *InstrumentedBucket) ReadAll(ctx context.Context, key string) ([]byte, error) {
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
		return retVal, err
	}
	labels[cdkBucketStatusLabel] = cdkBucketStatusSuccess
	b.requests.With(labels).Inc()
	b.latency.With(labels).Observe(end)
	return retVal, err
}

func (b *InstrumentedBucket) WriteAll(ctx context.Context, key string, p []byte, opts *blob.WriterOptions) error {
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
		return err
	}
	labels[cdkBucketStatusLabel] = cdkBucketStatusSuccess
	b.requests.With(labels).Inc()
	b.latency.With(labels).Observe(end)
	return err
}

func (b *InstrumentedBucket) SignedURL(ctx context.Context, key string, opts *blob.SignedURLOptions) (string, error) {
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
		return retVal, err
	}
	labels[cdkBucketStatusLabel] = cdkBucketStatusSuccess
	b.requests.With(labels).Inc()
	b.latency.With(labels).Observe(end)
	return retVal, err
}
