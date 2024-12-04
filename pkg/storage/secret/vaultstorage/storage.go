package vaultstorage

import "context"

// This is where we store an encrypted secret and retrieve it back.
// It can be local (i.e. SQL table) or remote (i.e. AWS, GCP, Vault).
type VaultStorageService interface {
	// what is something?
	Store(ctx context.Context, something any) (err error)
	Retrieve(ctx context.Context, something any) (ciphertext string, err error)
}
