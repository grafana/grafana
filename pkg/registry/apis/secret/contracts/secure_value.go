package contracts

import (
	"context"
	"errors"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
)

type DecryptSecureValue struct {
	Keeper     *string
	Ref        string
	ExternalID string
	Decrypters []string
}

var (
	ErrSecureValueNotFound            = errors.New("secure value not found")
	ErrSecureValueAlreadyExists       = errors.New("secure value already exists")
	ErrSecureValueOperationInProgress = errors.New("an operation is already in progress for the secure value")
)

// SecureValueMetadataStorage is the interface for wiring and dependency injection.
type SecureValueMetadataStorage interface {
	Create(ctx context.Context, sv *secretv0alpha1.SecureValue, actorUID string) (*secretv0alpha1.SecureValue, error)
	Read(ctx context.Context, namespace xkube.Namespace, name string, opts ReadOpts) (*secretv0alpha1.SecureValue, error)
	Update(ctx context.Context, sv *secretv0alpha1.SecureValue, actorUID string) (*secretv0alpha1.SecureValue, error)
	Delete(ctx context.Context, namespace xkube.Namespace, name string) error
	List(ctx context.Context, namespace xkube.Namespace) ([]secretv0alpha1.SecureValue, error)
	SetStatus(ctx context.Context, namespace xkube.Namespace, name string, status secretv0alpha1.SecureValueStatus) error
	SetExternalID(ctx context.Context, namespace xkube.Namespace, name string, externalID ExternalID) error
	ReadForDecrypt(ctx context.Context, namespace xkube.Namespace, name string) (*DecryptSecureValue, error)
}

type ReadOpts struct {
	ForUpdate bool
}
