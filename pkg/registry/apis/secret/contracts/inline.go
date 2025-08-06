package contracts

import (
	"context"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

type InlineSecureValueSupport interface {
	// Check that the request user can reference secure value names in the context of a given resource (owner)
	CanReference(ctx context.Context, owner common.ObjectReference, names ...string) error

	// CreateInline creates a secret that is owned by the referenced object
	// returns the name of the created secret or an error
	CreateInline(ctx context.Context, owner common.ObjectReference, value common.RawSecureValue) (string, error)

	// DeleteWhenOwnedByResource removes secrets if and only if they are owned by a referenced object
	DeleteWhenOwnedByResource(ctx context.Context, owner common.ObjectReference, names ...string) error
}
