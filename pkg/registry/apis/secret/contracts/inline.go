package contracts

import (
	"context"
	"fmt"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

var (
	ErrInlineSecureValueNoAuth          = fmt.Errorf("missing auth info in context for inline secure value operation")
	ErrInlineSecureValueInvalidName     = fmt.Errorf("invalid secure value name")
	ErrInlineSecureValueInvalidOwner    = fmt.Errorf("owner reference must have a valid API group, API version, kind and name ")
	ErrInlineSecureValueMismatchOwner   = fmt.Errorf("owner mismatch")
	ErrInlineSecureValueNotFound        = fmt.Errorf("secure value not found")
	ErrInlineSecureValueInvalidIdentity = fmt.Errorf("invalid identity")
	ErrInlineSecureValueCannotReference = fmt.Errorf("secure value cannot be referenced by the owner")
)

type InlineSecureValueSupport interface {
	// Check that the request user can reference secure value names in the context of a given resource (owner)
	CanReference(ctx context.Context, owner common.ObjectReference, names ...string) error

	// CreateInline creates a secret that is owned by the referenced object
	// returns the name of the created secret or an error
	CreateInline(ctx context.Context, owner common.ObjectReference, value common.RawSecureValue, desc *string) (string, error)

	// DeleteWhenOwnedByResource removes secrets if and only if they are owned by a referenced object
	// when name = *, then all secrets from the owner reference will be removed
	DeleteWhenOwnedByResource(ctx context.Context, owner common.ObjectReference, names ...string) error
}
