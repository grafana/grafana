package passkey

import (
	"context"
	"errors"
)

// ErrCredentialNotFound is returned by the store when no credential matches the lookup.
var ErrCredentialNotFound = errors.New("passkey credential not found")

// Store is the persistence layer for passkey credentials. It is an interface so the backend can later
// move to app-platform / unified storage without changing the service, client, handlers, or UI.
type Store interface {
	// Create inserts cred. It derives CredentialIDHash and sets Created, and populates cred.ID.
	Create(ctx context.Context, cred *Credential) error
	// GetByCredentialID looks a credential up by its raw credential id (via the stored hash).
	// It returns ErrCredentialNotFound if no credential matches.
	GetByCredentialID(ctx context.Context, credentialID []byte) (*Credential, error)
	// ListByUser returns all credentials enrolled by the given user.
	ListByUser(ctx context.Context, userID int64) ([]*Credential, error)
	// RecordUse persists the post-authentication sign counter and stamps last_used = now.
	RecordUse(ctx context.Context, id, signCount int64) error
	// Rename sets a credential's display name. It is scoped to userID so a user can only rename
	// their own credentials.
	Rename(ctx context.Context, id, userID int64, name string) error
	// Delete removes a credential. It is scoped to userID so a user can only delete their own.
	Delete(ctx context.Context, id, userID int64) error
}
