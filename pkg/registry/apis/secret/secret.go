package secret

import "context"

type Keeper interface {
	Store(ctx context.Context, sv SecureValue) (ManagedSecureValueID, error)
	Expose(ctx context.Context, id ManagedSecureValueID) (ExposedSecureValue, error)
	Delete(ctx context.Context, id ManagedSecureValueID) error
}
