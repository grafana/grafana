// Package gcsifaces provides interfaces for Google Cloud Storage.
//
//go:generate mockgen -source $GOFILE -destination ../../mocks/mock_gcsifaces/mocks.go StorageClient
package gcsifaces

import (
	"context"
	"io"

	"cloud.google.com/go/storage"
	"golang.org/x/oauth2/jwt"
)

// StorageClient represents a GCS client.
type StorageClient interface {
	// Bucket gets a StorageBucket.
	Bucket(name string) StorageBucket
	// JWTConfigFromJSON gets JWT config from a JSON document.
	JWTConfigFromJSON(keyJSON []byte) (*jwt.Config, error)
	// SignedURL returns a signed URL for the specified object.
	SignedURL(bucket, name string, opts *storage.SignedURLOptions) (string, error)
}

// StorageBucket represents a GCS bucket.
type StorageBucket interface {
	// Object returns a StorageObject for a key.
	Object(key string) StorageObject
	// SignedURL returns a signed URL for an object, deriving the signer from the
	// client's credentials when opts sets neither a private key nor SignBytes.
	SignedURL(object string, opts *storage.SignedURLOptions) (string, error)
}

// StorageObject represents a GCS object.
type StorageObject interface {
	// NewWriter returns a new StorageWriter.
	NewWriter(ctx context.Context) StorageWriter
}

// StorageWriter represents a GCS writer.
type StorageWriter interface {
	io.WriteCloser

	// SetACL sets a pre-defined ACL.
	SetACL(acl string)
}
