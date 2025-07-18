package contracts

import (
	"context"
	"errors"

	"github.com/grafana/grafana-app-sdk/resource"
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
	ErrSecureValueNotFound            = errors.New("secure value not found")
	ErrSecureValueAlreadyExists       = errors.New("secure value already exists")
	ErrSecureValueOperationInProgress = errors.New("an operation is already in progress for the secure value")
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
}

type SecureValueService interface {
	Create(ctx context.Context, sv *secretv1beta1.SecureValue, actorUID string) (*secretv1beta1.SecureValue, error)
	Read(ctx context.Context, namespace xkube.Namespace, name string) (*secretv1beta1.SecureValue, error)
	List(ctx context.Context, namespace xkube.Namespace) (*secretv1beta1.SecureValueList, error)
	Update(ctx context.Context, newSecureValue *secretv1beta1.SecureValue, actorUID string) (*secretv1beta1.SecureValue, bool, error)
	Delete(ctx context.Context, namespace xkube.Namespace, name string) (*secretv1beta1.SecureValue, error)
}

type SecureValueClientProvider interface {
	Client(ctx context.Context, namespace string) (SecureValueClient, error)
}

type SecureValueClient interface {
	List(ctx context.Context, opts resource.ListOptions) (*secretv1beta1.SecureValueList, error)
	Watch(ctx context.Context, opts resource.WatchOptions) (resource.WatchResponse, error)
	Get(ctx context.Context, uid string) (*secretv1beta1.SecureValue, error)
	Create(ctx context.Context, obj *secretv1beta1.SecureValue, opts resource.CreateOptions) (*secretv1beta1.SecureValue, error)
	Update(ctx context.Context, obj *secretv1beta1.SecureValue, opts resource.UpdateOptions) (*secretv1beta1.SecureValue, error)
	Patch(ctx context.Context, uid string, req resource.PatchRequest, opts resource.PatchOptions) (*secretv1beta1.SecureValue, error)
	Delete(ctx context.Context, uid string, opts resource.DeleteOptions) error
}
