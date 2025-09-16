package contracts

import (
	"context"
	"errors"

	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"k8s.io/apimachinery/pkg/util/validation/field"
)

var (
	ErrKeeperNotFound      = errors.New("keeper not found")
	ErrKeeperAlreadyExists = errors.New("keeper already exists")
)

// KeeperMetadataStorage is the interface for wiring and dependency injection.
type KeeperMetadataStorage interface {
	Create(ctx context.Context, keeper *secretv1beta1.Keeper, actorUID string) (*secretv1beta1.Keeper, error)
	Read(ctx context.Context, namespace xkube.Namespace, name string, opts ReadOpts) (*secretv1beta1.Keeper, error)
	Update(ctx context.Context, keeper *secretv1beta1.Keeper, actorUID string) (*secretv1beta1.Keeper, error)
	Delete(ctx context.Context, namespace xkube.Namespace, name string) error
	List(ctx context.Context, namespace xkube.Namespace) ([]secretv1beta1.Keeper, error)
	GetKeeperConfig(ctx context.Context, namespace string, name *string, opts ReadOpts) (secretv1beta1.KeeperConfig, error)
}

// ErrKeeperInvalidSecureValues is returned when a Keeper references SecureValues that do not exist.
type ErrKeeperInvalidSecureValues struct {
	invalidSecureValues map[string]struct{}
}

var _ xkube.ErrorLister = (*ErrKeeperInvalidSecureValues)(nil)

func NewErrKeeperInvalidSecureValues(invalidSecureValues map[string]struct{}) *ErrKeeperInvalidSecureValues {
	return &ErrKeeperInvalidSecureValues{invalidSecureValues: invalidSecureValues}
}

func (e *ErrKeeperInvalidSecureValues) Error() string {
	return e.ErrorList().ToAggregate().Error()
}

func (e *ErrKeeperInvalidSecureValues) ErrorList() field.ErrorList {
	errs := make(field.ErrorList, 0, len(e.invalidSecureValues))

	path := field.NewPath("secureValueName")

	for sv := range e.invalidSecureValues {
		errs = append(errs, field.NotFound(path, sv))
	}

	return errs
}

// ErrKeeperInvalidSecureValuesReference is returned when a Keeper references SecureValues from a non-SQL Keeper.
type ErrKeeperInvalidSecureValuesReference struct {
	invalidSecureValues map[string]string
}

var _ xkube.ErrorLister = (*ErrKeeperInvalidSecureValuesReference)(nil)

func NewErrKeeperInvalidSecureValuesReference(invalidSecureValues map[string]string) *ErrKeeperInvalidSecureValuesReference {
	return &ErrKeeperInvalidSecureValuesReference{invalidSecureValues: invalidSecureValues}
}

func (e *ErrKeeperInvalidSecureValuesReference) Error() string {
	return e.ErrorList().ToAggregate().Error()
}

func (e *ErrKeeperInvalidSecureValuesReference) ErrorList() field.ErrorList {
	errs := make(field.ErrorList, 0, len(e.invalidSecureValues))

	path := field.NewPath("secureValueName")

	for sv, keeper := range e.invalidSecureValues {
		errs = append(
			errs,
			field.TypeInvalid(
				path,
				sv,
				`cannot reference third-party keeper "`+keeper+`" in another third-party keeper, use a "sql" keeper instead`,
			),
		)
	}

	return errs
}

// ExternalID represents either the secure value's GUID or ref (in case of external secret references).
// This is saved in the secure_value metadata storage as `external_id`.
// TODO: this does not belong in the k8s spec, but it is used by us internally. Place it somewhere appropriate.
type ExternalID string

func (s ExternalID) String() string {
	return string(s)
}

// Keeper is the interface for secret keepers.
type Keeper interface {
	Store(ctx context.Context, cfg secretv1beta1.KeeperConfig, namespace, name string, version int64, exposedValueOrRef string) (ExternalID, error)
	Update(ctx context.Context, cfg secretv1beta1.KeeperConfig, namespace, name string, version int64, exposedValueOrRef string) error
	Expose(ctx context.Context, cfg secretv1beta1.KeeperConfig, namespace, name string, version int64) (secretv1beta1.ExposedSecureValue, error)
	Delete(ctx context.Context, cfg secretv1beta1.KeeperConfig, namespace, name string, version int64) error
}

// Service is the interface for secret keeper services.
// This exists because OSS and Enterprise have different amounts of keepers available.
type KeeperService interface {
	KeeperForConfig(secretv1beta1.KeeperConfig) (Keeper, error)
}
