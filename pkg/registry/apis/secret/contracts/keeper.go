package contracts

import (
	"context"
	"errors"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	"k8s.io/apimachinery/pkg/util/validation/field"
)

var (
	ErrKeeperNotFound = errors.New("keeper not found")
)

// KeeperMetadataStorage is the interface for wiring and dependency injection.
type KeeperMetadataStorage interface {
	Create(ctx context.Context, keeper *secretv0alpha1.Keeper) (*secretv0alpha1.Keeper, error)
	Read(ctx context.Context, namespace xkube.Namespace, name string) (*secretv0alpha1.Keeper, error)
	Update(ctx context.Context, keeper *secretv0alpha1.Keeper) (*secretv0alpha1.Keeper, error)
	Delete(ctx context.Context, namespace xkube.Namespace, name string) error
	List(ctx context.Context, namespace xkube.Namespace, options *internalversion.ListOptions) (*secretv0alpha1.KeeperList, error)
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
