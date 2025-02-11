package contracts

import (
	"context"
	"errors"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
)

var (
	ErrSecureValueNotFound = errors.New("secure value not found")
)

// SecureValueStorage is the interface for wiring and dependency injection.
type SecureValueStorage interface {
	Create(ctx context.Context, sv *secretv0alpha1.SecureValue) (*secretv0alpha1.SecureValue, error)
	Read(ctx context.Context, name string, namespace string) (*secretv0alpha1.SecureValue, error)
	Update(ctx context.Context, sv *secretv0alpha1.SecureValue) (*secretv0alpha1.SecureValue, error)
	Delete(ctx context.Context, name string, namespace string) error
	List(ctx context.Context, namespace string, options *internalversion.ListOptions) (*secretv0alpha1.SecureValueList, error)
}
