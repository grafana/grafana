package contracts

import (
	"context"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

// SecureValue storage support
//
//go:generate mockery --name InlineSecureValueStore --structname MockInlineSecureValueStore --inpackage --filename store_mock.go --with-expecter

type InlineSecureValueStore interface {
	// Check that the request user can reference a secret in the context of a given resource (owner)
	CanReference(ctx context.Context, owner common.ResourceReference, names ...string) (bool, error)

	// Create inline secure value
	CreateSecureValue(ctx context.Context, owner common.ResourceReference, value common.RawSecretValue) (string, error)

	// Called when deleting the referenced values IFF they are owned by the owner
	// for shared values, they are not deleted and no error is returned
	DeleteValuesForOwner(ctx context.Context, owner common.ResourceReference, names ...string) error
}
