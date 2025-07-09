package contracts

import (
	"context"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

// SecureValue storage support
//
//go:generate mockery --name InlineSecureValueStore --structname MockInlineSecureValueStore --inpackage --filename inline_mock.go --with-expecter

type InlineSecureValueStore interface {
	// Check that the request user can reference a secret in the context of a given resource (owner)
	CanReference(ctx context.Context, owner common.ResourceReference, names ...string) (bool, error)

	// Update secure values for the resource
	// Values that are either REMOVED or no longer present in the set will be deleted
	// Updates with equal raw values may continue using the previously saved name
	UpdateSecureValues(ctx context.Context, owner common.ResourceReference, secure common.InlineSecureValues) (common.InlineSecureValues, error)
}
