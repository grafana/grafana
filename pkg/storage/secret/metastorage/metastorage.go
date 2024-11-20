package metastorage

import (
	"context"
)

// This is supposed to keep secure value metadata.
// It needs enough data to be able to know how to retrieve the data from the underlying "vault storage" (where the secret is kept),
// and how to decrypt it (either remotely or locally).
type SecretMetadataStore interface {
	// how do we request this?
	Retrieve(ctx context.Context, name, namespace string) (SecureValueMetadata, error)
	Store(ctx context.Context, meta SecureValueMetadata) error
}

type SecureValueMetadata struct {
	EncryptionProvider   string
	VaultStorageProvider string
	UID                  string
	Name                 string
	Namespace            string
	// what else do we need here?
}
