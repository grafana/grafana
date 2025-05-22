package resource

import (
	"context"
	"fmt"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel"
	"gocloud.dev/blob"
)

var _ CDKBucket = (*fakeCDKBucket)(nil)

type fakeCDKBucket struct {
	attributesFunc func(ctx context.Context, key string) (*blob.Attributes, error)
	writeAllFunc   func(ctx context.Context, key string, p []byte, opts *blob.WriterOptions) error
	readAllFunc    func(ctx context.Context, key string) ([]byte, error)
	signedURLFunc  func(ctx context.Context, key string, opts *blob.SignedURLOptions) (string, error)
	listFunc       func(opts *blob.ListOptions) *blob.ListIterator
	listPageFunc   func(ctx context.Context, pageToken []byte, pageSize int, opts *blob.ListOptions) ([]*blob.ListObject, []byte, error)
	deleteFunc     func(ctx context.Context, key string) error
}

func (f *fakeCDKBucket) Attributes(ctx context.Context, key string) (*blob.Attributes, error) {
	if f.attributesFunc != nil {
		return f.attributesFunc(ctx, key)
	}
	return nil, nil
}

func (f *fakeCDKBucket) WriteAll(ctx context.Context, key string, p []byte, opts *blob.WriterOptions) error {
	if f.writeAllFunc != nil {
		return f.writeAllFunc(ctx, key, p, opts)
	}
	return nil
}

func (f *fakeCDKBucket) ReadAll(ctx context.Context, key string) ([]byte, error) {
	if f.readAllFunc != nil {
		return f.readAllFunc(ctx, key)
	}
	return nil, nil
}

func (f *fakeCDKBucket) SignedURL(ctx context.Context, key string, opts *blob.SignedURLOptions) (string, error) {
	if f.signedURLFunc != nil {
		return f.signedURLFunc(ctx, key, opts)
	}
	return "", nil
}

func (f *fakeCDKBucket) List(opts *blob.ListOptions) *blob.ListIterator {
	if f.listFunc != nil {
		return f.listFunc(opts)
	}
	return nil
}

func (f *fakeCDKBucket) ListPage(ctx context.Context, pageToken []byte, pageSize int, opts *blob.ListOptions) ([]*blob.ListObject, []byte, error) {
	if f.listPageFunc != nil {
		return f.listPageFunc(ctx, pageToken, pageSize, opts)
	}
	return nil, nil, nil
}

func (f *fakeCDKBucket) Delete(ctx context.Context, key string) error {
	if f.deleteFunc != nil {
		return f.deleteFunc(ctx, key)
	}
	return nil
}

func TestInstrumentedBucket(t *testing.T) {
	operations := []struct {
		name      string
		operation string
		setup     func(fakeBucket *fakeCDKBucket, success bool)
		call      func(instrumentedBucket *InstrumentedBucket) error
	}{
		{
			name:      "Attributes",
			operation: "Attributes",
			setup: func(fakeBucket *fakeCDKBucket, success bool) {
				if success {
					fakeBucket.attributesFunc = func(ctx context.Context, key string) (*blob.Attributes, error) {
						return &blob.Attributes{}, nil
					}
				} else {
					fakeBucket.attributesFunc = func(ctx context.Context, key string) (*blob.Attributes, error) {
						return nil, fmt.Errorf("some error")
					}
				}
			},
			call: func(instrumentedBucket *InstrumentedBucket) error {
				_, err := instrumentedBucket.Attributes(context.Background(), "key")
				return err
			},
		},
		{
			name:      "WriteAll",
			operation: "WriteAll",
			setup: func(fakeBucket *fakeCDKBucket, success bool) {
				if success {
					fakeBucket.writeAllFunc = func(ctx context.Context, key string, p []byte, opts *blob.WriterOptions) error {
						return nil
					}
				} else {
					fakeBucket.writeAllFunc = func(ctx context.Context, key string, p []byte, opts *blob.WriterOptions) error {
						return fmt.Errorf("some error")
					}
				}
			},
			call: func(instrumentedBucket *InstrumentedBucket) error {
				err := instrumentedBucket.WriteAll(context.Background(), "key", []byte("data"), nil)
				return err
			},
		},
		{
			name:      "Delete",
			operation: "Delete",
			setup: func(fakeBucket *fakeCDKBucket, success bool) {
				if success {
					fakeBucket.deleteFunc = func(ctx context.Context, key string) error {
						return nil
					}
				} else {
					fakeBucket.deleteFunc = func(ctx context.Context, key string) error {
						return fmt.Errorf("some error")
					}
				}
			},
			call: func(instrumentedBucket *InstrumentedBucket) error {
				return instrumentedBucket.Delete(context.Background(), "key")
			},
		},
		{
			name:      "ReadAll",
			operation: "ReadAll",
			setup: func(fakeBucket *fakeCDKBucket, success bool) {
				if success {
					fakeBucket.readAllFunc = func(ctx context.Context, key string) ([]byte, error) {
						return []byte("data"), nil
					}
				} else {
					fakeBucket.readAllFunc = func(ctx context.Context, key string) ([]byte, error) {
						return nil, fmt.Errorf("some error")
					}
				}
			},
			call: func(instrumentedBucket *InstrumentedBucket) error {
				_, err := instrumentedBucket.ReadAll(context.Background(), "key")
				return err
			},
		},
		{
			name:      "SignedURL",
			operation: "SignedURL",
			setup: func(fakeBucket *fakeCDKBucket, success bool) {
				if success {
					fakeBucket.signedURLFunc = func(ctx context.Context, key string, opts *blob.SignedURLOptions) (string, error) {
						return "http://signed.url", nil
					}
				} else {
					fakeBucket.signedURLFunc = func(ctx context.Context, key string, opts *blob.SignedURLOptions) (string, error) {
						return "", fmt.Errorf("some error")
					}
				}
			},
			call: func(instrumentedBucket *InstrumentedBucket) error {
				_, err := instrumentedBucket.SignedURL(context.Background(), "key", nil)
				return err
			},
		},
	}

	for _, op := range operations {
		for _, tc := range []struct {
			name               string
			success            bool
			expectedCountLabel string
		}{
			{
				name:               "success",
				success:            true,
				expectedCountLabel: cdkBucketStatusSuccess,
			},
			{
				name:               "failure",
				success:            false,
				expectedCountLabel: cdkBucketStatusError,
			},
		} {
			t.Run(op.name+" "+tc.name, func(t *testing.T) {
				fakeBucket := &fakeCDKBucket{}
				reg := prometheus.NewPedanticRegistry()
				tracer := otel.Tracer("test")
				instrumentedBucket := NewInstrumentedBucket(fakeBucket, reg, tracer)

				op.setup(fakeBucket, tc.success)
				err := op.call(instrumentedBucket)

				if tc.success {
					require.NoError(t, err)
				} else {
					require.Error(t, err)
				}

				count := testutil.ToFloat64(instrumentedBucket.requests.WithLabelValues(op.operation, tc.expectedCountLabel))
				require.Equal(t, 1.0, count)
			})
		}
	}
}
