package lock

import (
	"context"
	"errors"
	"fmt"
	"net/url"

	gcsstorage "cloud.google.com/go/storage"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob"
	azblobblob "github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/blob"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/container"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	smithyhttp "github.com/aws/smithy-go/transport/http"
	"gocloud.dev/blob"
	"gocloud.dev/gcerrors"
	"google.golang.org/api/googleapi"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// bucketTarget holds the parsed bucket/container name and optional key prefix
// from a gocloud blob URL (e.g. s3://my-bucket?prefix=locks/).
type bucketTarget struct {
	name   string
	prefix string
}

// objectKey returns the full object key with the prefix applied.
func (t bucketTarget) objectKey(key string) string {
	return t.prefix + key
}

// CDKLockOptionsFromBucket detects the provider behind bucket and returns matching
// CDKLockBackendOptions. Returns an error for unsupported providers.
// The bucketURL is parsed for the bucket name and an optional ?prefix= parameter.
func CDKLockOptionsFromBucket(bucket *blob.Bucket, bucketURL string) (CDKLockBackendOptions, error) {
	target, err := bucketTargetFromURL(bucketURL)
	if err != nil {
		return CDKLockBackendOptions{}, fmt.Errorf("parse bucket URL: %w", err)
	}
	if target.prefix != "" {
		// Validate prefix early: append a safe probe char to form a full key.
		if err := validateObjectKey(target.prefix + "probe"); err != nil {
			return CDKLockBackendOptions{}, fmt.Errorf("unsafe bucket prefix: %w", err)
		}
	}
	optsFn := func(w ConditionalWriteFunc, d ConditionalDeleteFunc) (CDKLockBackendOptions, error) {
		return CDKLockBackendOptions{
			ConditionalWrite:  w,
			ConditionalDelete: d,
		}, nil
	}
	var s3Client *s3.Client
	var gcsClient *gcsstorage.Client
	var containerClient *container.Client
	switch {
	case bucket.As(&s3Client):
		return optsFn(s3ConditionalWrite, s3ConditionalDelete(s3Client, target))
	case bucket.As(&gcsClient):
		return optsFn(gcsConditionalWrite, gcsConditionalDelete(gcsClient, target))
	case bucket.As(&containerClient):
		return optsFn(azureConditionalWrite, azureConditionalDelete(containerClient, target))
	default:
		return CDKLockBackendOptions{}, fmt.Errorf("unsupported blob provider: conditional writes required for distributed locking")
	}
}

// bucketTargetFromURL extracts the bucket/container name and optional prefix
// from a gocloud blob URL. Supported schemes: s3://bucket, gs://bucket, azblob://container.
func bucketTargetFromURL(bucketURL string) (bucketTarget, error) {
	u, err := url.Parse(bucketURL)
	if err != nil {
		return bucketTarget{}, err
	}
	name := u.Host
	if name == "" {
		// file:// URLs have no meaningful bucket name, but callers won't need it
		// since fileblob doesn't match any provider As() above.
		name = u.Opaque
	}
	return bucketTarget{
		name:   name,
		prefix: u.Query().Get("prefix"),
	}, nil
}

// isObjectExistsErr returns true if the error indicates the object already exists.
// Checks gcerrors.FailedPrecondition (GCS, Azure, S3-412) and smithy HTTP 409
// (S3 ConditionalRequestConflict from If-None-Match: * races, which gocloud.dev
// maps to gcerrors.Unknown instead of FailedPrecondition).
func isObjectExistsErr(err error) bool {
	if gcerrors.Code(err) == gcerrors.FailedPrecondition {
		return true
	}
	var respErr *smithyhttp.ResponseError
	return errors.As(err, &respErr) && respErr.HTTPStatusCode() == 409
}

// --- S3 ---

func s3ConditionalWrite(attrs *blob.Attributes) func(asFunc func(any) bool) error {
	return func(asFunc func(any) bool) error {
		var input *s3.PutObjectInput
		if !asFunc(&input) {
			return fmt.Errorf("failed to access S3 PutObjectInput from BeforeWrite")
		}
		input.IfMatch = aws.String(attrs.ETag)
		return nil
	}
}

func s3ConditionalDelete(client *s3.Client, target bucketTarget) ConditionalDeleteFunc {
	return func(ctx context.Context, key string, attrs *blob.Attributes) error {
		_, err := client.DeleteObject(ctx, &s3.DeleteObjectInput{
			Bucket:  aws.String(target.name),
			Key:     aws.String(target.objectKey(key)),
			IfMatch: aws.String(attrs.ETag),
		})
		if err != nil {
			var respErr *smithyhttp.ResponseError
			if errors.As(err, &respErr) {
				switch respErr.HTTPStatusCode() {
				case 412:
					return fmt.Errorf("%w: %w", errPreconditionFailed, err)
				case 404:
					return fmt.Errorf("%w: %w", ErrLockNotFound, err)
				}
			}
		}
		return err
	}
}

// --- GCS ---

func gcsConditionalWrite(attrs *blob.Attributes) func(asFunc func(any) bool) error {
	return func(asFunc func(any) bool) error {
		// gcsblob requires **storage.ObjectHandle to be accessed before
		// *storage.Writer in the AsFunc call order.
		var objHandle **gcsstorage.ObjectHandle
		if !asFunc(&objHandle) {
			return fmt.Errorf("failed to access GCS ObjectHandle from BeforeWrite")
		}
		var gcsAttrs gcsstorage.ObjectAttrs
		if !attrs.As(&gcsAttrs) {
			return fmt.Errorf("failed to extract GCS generation from attributes")
		}
		*objHandle = (*objHandle).If(gcsstorage.Conditions{
			GenerationMatch: gcsAttrs.Generation,
		})
		return nil
	}
}

func gcsConditionalDelete(client *gcsstorage.Client, target bucketTarget) ConditionalDeleteFunc {
	return func(ctx context.Context, key string, attrs *blob.Attributes) error {
		var gcsAttrs gcsstorage.ObjectAttrs
		if !attrs.As(&gcsAttrs) {
			return fmt.Errorf("failed to extract GCS generation from attributes")
		}
		obj := client.Bucket(target.name).Object(target.objectKey(key))
		err := obj.If(gcsstorage.Conditions{
			GenerationMatch: gcsAttrs.Generation,
		}).Delete(ctx)
		if err != nil {
			// GCS uses REST by default (*googleapi.Error), but may use gRPC. Check both.
			var apiErr *googleapi.Error
			if errors.As(err, &apiErr) {
				switch apiErr.Code {
				case 412:
					return fmt.Errorf("%w: %w", errPreconditionFailed, err)
				case 404:
					return fmt.Errorf("%w: %w", ErrLockNotFound, err)
				}
			}
			if s, ok := status.FromError(err); ok {
				switch s.Code() { //nolint:exhaustive
				case codes.FailedPrecondition:
					return fmt.Errorf("%w: %w", errPreconditionFailed, err)
				case codes.NotFound:
					return fmt.Errorf("%w: %w", ErrLockNotFound, err)
				}
			}
		}
		return err
	}
}

// --- Azure ---

func azureConditionalWrite(attrs *blob.Attributes) func(asFunc func(any) bool) error {
	return func(asFunc func(any) bool) error {
		var opts *azblob.UploadStreamOptions
		if !asFunc(&opts) {
			return fmt.Errorf("failed to access Azure UploadStreamOptions from BeforeWrite")
		}
		etag := azcore.ETag(attrs.ETag)
		opts.AccessConditions = &azblob.AccessConditions{
			ModifiedAccessConditions: &azblobblob.ModifiedAccessConditions{
				IfMatch: &etag,
			},
		}
		return nil
	}
}

func azureConditionalDelete(containerClient *container.Client, target bucketTarget) ConditionalDeleteFunc {
	return func(ctx context.Context, key string, attrs *blob.Attributes) error {
		etag := azcore.ETag(attrs.ETag)
		blobClient := containerClient.NewBlobClient(target.objectKey(key))
		_, err := blobClient.Delete(ctx, &azblobblob.DeleteOptions{
			AccessConditions: &azblobblob.AccessConditions{
				ModifiedAccessConditions: &azblobblob.ModifiedAccessConditions{
					IfMatch: &etag,
				},
			},
		})
		if err != nil {
			var respErr *azcore.ResponseError
			if errors.As(err, &respErr) {
				switch respErr.StatusCode {
				case 412:
					return fmt.Errorf("%w: %w", errPreconditionFailed, err)
				case 404:
					return fmt.Errorf("%w: %w", ErrLockNotFound, err)
				}
			}
		}
		return err
	}
}
