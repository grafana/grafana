package securevalue

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

//go:generate mockery --name InlineSecureValueSupport --structname MockInlineSecureValueSupport --inpackage --filename inline_mock.go --with-expecter
type InlineSecureValueSupport interface {
	// Check that the request user can reference secure value names in the context of a given resource (owner)
	CanReference(ctx context.Context, owner common.ObjectReference, names ...string) error

	// CreateInline creates a secret that is owned by the referenced object
	// returns the name of the created secret or an error
	CreateInline(ctx context.Context, owner common.ObjectReference, value resource.RawSecureValue, desc *string) (string, error)

	// DeleteWhenOwnedByResource removes secrets if and only if they are owned by a referenced object
	// when name = *, then all secrets from the owner reference will be removed
	DeleteWhenOwnedByResource(ctx context.Context, owner common.ObjectReference, names ...string) error
}
