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

// KeeperStorage is the interface for wiring and dependency injection.
type KeeperStorage interface {
	Create(ctx context.Context, sv *secretv0alpha1.Keeper) (*secretv0alpha1.Keeper, error)
	Read(ctx context.Context, nn xkube.NameNamespace) (*secretv0alpha1.Keeper, error)
	Update(ctx context.Context, sv *secretv0alpha1.Keeper) (*secretv0alpha1.Keeper, error)
	Delete(ctx context.Context, nn xkube.NameNamespace) error
	List(ctx context.Context, namespace xkube.Namespace, options *internalversion.ListOptions) (*secretv0alpha1.KeeperList, error)
}

// ErrKeeperInvalidSecureValues is returned when a Keeper references SecureValues that do not exist.
type ErrKeeperInvalidSecureValues struct {
	invalidSecureValues map[string]struct{}
}

var _ error = (*ErrKeeperInvalidSecureValues)(nil)

func NewErrKeeperInvalidSecureValues(invalidSecureValues map[string]struct{}) *ErrKeeperInvalidSecureValues {
	return &ErrKeeperInvalidSecureValues{invalidSecureValues: invalidSecureValues}
}

func (e *ErrKeeperInvalidSecureValues) Error() string {
	return e.ErrorList().ToAggregate().Error()
}

func (e *ErrKeeperInvalidSecureValues) ErrorList() field.ErrorList {
	errs := make(field.ErrorList, 0, len(e.invalidSecureValues))

	for k := range e.invalidSecureValues {
		errs = append(errs, field.NotFound(field.NewPath("secureValueName"), k))
	}

	return errs
}
