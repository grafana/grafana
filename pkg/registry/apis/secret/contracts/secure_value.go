package contracts

import (
	"context"
	"errors"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/dynamic"

	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
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
	ErrSecureValueNotFound      = errors.New("secure value not found")
	ErrSecureValueAlreadyExists = errors.New("secure value already exists")
)

type ReadOpts struct {
	ForUpdate bool
}

// SecureValueMetadataStorage is the interface for wiring and dependency injection.
type SecureValueMetadataStorage interface {
	Create(ctx context.Context, sv *secretv1beta1.SecureValue, actorUID string) (*secretv1beta1.SecureValue, error)
	Read(ctx context.Context, namespace xkube.Namespace, name string, opts ReadOpts) (*secretv1beta1.SecureValue, error)
	List(ctx context.Context, namespace xkube.Namespace) ([]secretv1beta1.SecureValue, error)
	SetVersionToActive(ctx context.Context, namespace xkube.Namespace, name string, version int64) error
	SetVersionToInactive(ctx context.Context, namespace xkube.Namespace, name string, version int64) error
	SetExternalID(ctx context.Context, namespace xkube.Namespace, name string, version int64, externalID ExternalID) error
	MatchingOwner(ctx context.Context, namespace xkube.Namespace, ownerReference metav1.OwnerReference) (secureValueNames []string, err error)
}

type SecureValueService interface {
	Create(ctx context.Context, sv *secretv1beta1.SecureValue, actorUID string) (*secretv1beta1.SecureValue, error)
	Read(ctx context.Context, namespace xkube.Namespace, name string) (*secretv1beta1.SecureValue, error)
	List(ctx context.Context, namespace xkube.Namespace) (*secretv1beta1.SecureValueList, error)
	Update(ctx context.Context, newSecureValue *secretv1beta1.SecureValue, actorUID string) (*secretv1beta1.SecureValue, bool, error)
	Delete(ctx context.Context, namespace xkube.Namespace, name string) (*secretv1beta1.SecureValue, error)
}

type SecureValueClient interface {
	Client(ctx context.Context, namespace string) (dynamic.ResourceInterface, error)
}
