package contracts

import (
	"context"
	"errors"

	"github.com/puzpuzpuz/xsync/v4"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	decryptcontracts "github.com/grafana/grafana/apps/secret/pkg/decrypt"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
)

// HeaderGrafanaServiceIdentityName is used to pass the service identity in the gRPC request metadata.
const HeaderGrafanaServiceIdentityName = "X-Grafana-Service-Identity-Name"

var (
	ErrDecryptNotFound      = errors.New("not found")
	ErrDecryptNotAuthorized = errors.New("not authorized")
	ErrDecryptFailed        = errors.New("decryption failed")
)

// DecryptManyResult includes a value or a domain error for every requested name.
type DecryptManyResult = *xsync.Map[string, decryptcontracts.DecryptResult]

// DecryptStorage is the interface for wiring and dependency injection.
type DecryptStorage interface {
	Decrypt(ctx context.Context, namespace xkube.Namespace, name string) (secretv1beta1.ExposedSecureValue, error)
	DecryptMany(ctx context.Context, namespace xkube.Namespace, names []string) (DecryptManyResult, error)
}

// DecryptAuthorizer is the interface for authorizing decryption requests.
type DecryptAuthorizer interface {
	Authorize(ctx context.Context, namespace xkube.Namespace, secureValueName string, secureValueDecrypters []string, owner []metav1.OwnerReference) (identity string, allowed bool, reason string)
}
