package contracts

import (
	"context"
	"errors"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
)

var (
	ErrSecureValueNotFound = errors.New("secure value not found")
)

// SecureValueMetadataStorage is the interface for wiring and dependency injection.
type SecureValueMetadataStorage interface {
	Create(ctx context.Context, sv *secretv0alpha1.SecureValue) (*secretv0alpha1.SecureValue, error)
	Read(ctx context.Context, namespace xkube.Namespace, name string) (*secretv0alpha1.SecureValue, error)
	Update(ctx context.Context, sv *secretv0alpha1.SecureValue) (*secretv0alpha1.SecureValue, error)
	Delete(ctx context.Context, namespace xkube.Namespace, name string) error
	List(ctx context.Context, namespace xkube.Namespace, options *internalversion.ListOptions) (*secretv0alpha1.SecureValueList, error)
}
