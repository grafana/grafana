package contracts

import (
	"context"
	"errors"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
)

// The maximum size of a secure value in bytes when written as raw input.
const SECURE_VALUE_RAW_INPUT_MAX_SIZE_BYTES = 24576 // 24 KiB

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

type ReadOpts struct {
	ForUpdate bool
}

// SecureValueMetadataStorage is the interface for wiring and dependency injection.
type SecureValueMetadataStorage interface {
	Create(ctx context.Context, sv *secretv0alpha1.SecureValue, actorUID string) (*secretv0alpha1.SecureValue, error)
	Read(ctx context.Context, namespace xkube.Namespace, name string, opts ReadOpts) (*secretv0alpha1.SecureValue, error)
	List(ctx context.Context, namespace xkube.Namespace) ([]secretv0alpha1.SecureValue, error)
	SetVersionToActive(ctx context.Context, namespace xkube.Namespace, name string, version int64) error
	SetVersionToInactive(ctx context.Context, namespace xkube.Namespace, name string, version int64) error
	SetExternalID(ctx context.Context, namespace xkube.Namespace, name string, version int64, externalID ExternalID) error
	ReadForDecrypt(ctx context.Context, namespace xkube.Namespace, name string) (*DecryptSecureValue, error)
}
