package search

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"time"

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

var errPreconditionFailed = errors.New("precondition failed")

// conditionalOps groups the conditional write and delete operations for a single
// cloud provider. Implementations must wrap errPreconditionFailed to signal
// concurrent modification on delete.
// When nil, the backend falls back to unconditional writes/deletes.
type conditionalOps interface {
	// BeforeWrite returns a callback for blob.WriterOptions.BeforeWrite that sets
	// provider-specific If-Match / ifGenerationMatch headers.
	BeforeWrite(attrs *blob.Attributes) func(asFunc func(any) bool) error

	// Delete performs a conditional delete using native provider SDKs.
	Delete(ctx context.Context, key string, attrs *blob.Attributes) error
}

// cdkLockBackendOptions holds optional configuration for cdkLockBackend.
type cdkLockBackendOptions struct {
	ops conditionalOps
	// clockSkewAllowance accounts for clock skew between instances when checking lock expiry (30s default)
	clockSkewAllowance time.Duration
}

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

// cdkLockOptionsFromBucket detects the provider behind bucket and returns matching
// cdkLockBackendOptions. Returns an error for unsupported providers.
// The bucketURL is parsed for the bucket name and an optional ?prefix= parameter.
func cdkLockOptionsFromBucket(bucket *blob.Bucket, bucketURL string) (cdkLockBackendOptions, error) {
	target, err := bucketTargetFromURL(bucketURL)
	if err != nil {
		return cdkLockBackendOptions{}, fmt.Errorf("parse bucket URL: %w", err)
	}
	if err := validatePrefix(target.prefix); err != nil {
		return cdkLockBackendOptions{}, err
	}
	var s3Client *s3.Client
	var gcsClient *gcsstorage.Client
	var containerClient *container.Client
	switch {
	case bucket.As(&s3Client):
		return cdkLockBackendOptions{ops: &s3Ops{client: s3Client, target: target}}, nil
	case bucket.As(&gcsClient):
		return cdkLockBackendOptions{ops: &gcsOps{client: gcsClient, target: target}}, nil
	case bucket.As(&containerClient):
		return cdkLockBackendOptions{ops: &azureOps{client: containerClient, target: target}}, nil
	default:
		return cdkLockBackendOptions{}, fmt.Errorf("unsupported blob provider: conditional writes required for distributed locking")
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
// (gocloud.dev maps S3 ConditionalRequestConflict to gcerrors.Unknown instead of FailedPrecondition)
func isObjectExistsErr(err error) bool {
	if gcerrors.Code(err) == gcerrors.FailedPrecondition {
		return true
	}
	var respErr *smithyhttp.ResponseError
	return errors.As(err, &respErr) && respErr.HTTPStatusCode() == 409
}

// mapDeleteStatus maps HTTP status codes from a conditional delete response to
// lock-package sentinel errors. Returns err unchanged for unmapped codes.
func mapDeleteStatus(httpStatus int, err error) error {
	switch httpStatus {
	case 412:
		return fmt.Errorf("%w: %w", errPreconditionFailed, err)
	case 404:
		return fmt.Errorf("%w: %w", errLockNotFound, err)
	}
	return err
}

// --- S3 ---

type s3Ops struct {
	client *s3.Client
	target bucketTarget
}

func (o *s3Ops) BeforeWrite(attrs *blob.Attributes) func(asFunc func(any) bool) error {
	return func(asFunc func(any) bool) error {
		var input *s3.PutObjectInput
		if !asFunc(&input) {
			return fmt.Errorf("failed to access S3 PutObjectInput from BeforeWrite")
		}
		input.IfMatch = aws.String(attrs.ETag)
		return nil
	}
}

func (o *s3Ops) Delete(ctx context.Context, key string, attrs *blob.Attributes) error {
	_, err := o.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket:  aws.String(o.target.name),
		Key:     aws.String(o.target.objectKey(key)),
		IfMatch: aws.String(attrs.ETag),
	})
	if err != nil {
		var respErr *smithyhttp.ResponseError
		if errors.As(err, &respErr) {
			return mapDeleteStatus(respErr.HTTPStatusCode(), err)
		}
	}
	return err
}

// --- GCS ---

type gcsOps struct {
	client *gcsstorage.Client
	target bucketTarget
}

func (o *gcsOps) BeforeWrite(attrs *blob.Attributes) func(asFunc func(any) bool) error {
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

func (o *gcsOps) Delete(ctx context.Context, key string, attrs *blob.Attributes) error {
	var gcsAttrs gcsstorage.ObjectAttrs
	if !attrs.As(&gcsAttrs) {
		return fmt.Errorf("failed to extract GCS generation from attributes")
	}
	obj := o.client.Bucket(o.target.name).Object(o.target.objectKey(key))
	err := obj.If(gcsstorage.Conditions{
		GenerationMatch: gcsAttrs.Generation,
	}).Delete(ctx)
	if err != nil {
		// GCS uses REST by default (*googleapi.Error), but may use gRPC. Check both.
		var apiErr *googleapi.Error
		if errors.As(err, &apiErr) {
			return mapDeleteStatus(apiErr.Code, err)
		}
		if s, ok := status.FromError(err); ok {
			switch s.Code() { //nolint:exhaustive
			case codes.FailedPrecondition:
				return fmt.Errorf("%w: %w", errPreconditionFailed, err)
			case codes.NotFound:
				return fmt.Errorf("%w: %w", errLockNotFound, err)
			}
		}
	}
	return err
}

// --- Azure ---

type azureOps struct {
	client *container.Client
	target bucketTarget
}

func (o *azureOps) BeforeWrite(attrs *blob.Attributes) func(asFunc func(any) bool) error {
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

func (o *azureOps) Delete(ctx context.Context, key string, attrs *blob.Attributes) error {
	etag := azcore.ETag(attrs.ETag)
	blobClient := o.client.NewBlobClient(o.target.objectKey(key))
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
			return mapDeleteStatus(respErr.StatusCode, err)
		}
	}
	return err
}
