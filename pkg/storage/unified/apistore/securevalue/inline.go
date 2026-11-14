package securevalue

import (
	"context"
	"strings"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

// This prefix marks a dynamic secure value: a reserved name the secrets service resolves on each
// decrypt (for example by minting a short-lived token) instead of reading a stored value.
// Nothing is stored for it, so it is never deleted. Only a secrets service that supports dynamic
// values accepts a reference to one in CanReference; others reject it.
const DYNAMIC_SECURE_VALUE_NAME_PREFIX = "dynamic:"

func IsDynamicSecureValueName(name string) bool {
	return strings.HasPrefix(name, DYNAMIC_SECURE_VALUE_NAME_PREFIX)
}

//go:generate mockery --name InlineSecureValueSupport --structname MockInlineSecureValueSupport --inpackage --filename inline_mock.go --with-expecter
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
