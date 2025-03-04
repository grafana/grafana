package contracts

import (
	"context"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"k8s.io/apiserver/pkg/authorization/authorizer"
)

// DecryptStorage is the interface for wiring and dependency injection.
type DecryptStorage interface {
	Decrypt(ctx context.Context, namespace xkube.Namespace, name string) (secretv0alpha1.ExposedSecureValue, error)
}

// DecryptClient will have a function-call implementation and a gRPC implementation.
// The function-call implementation is used by the gRPC server, and the gRPC implementation calls that same gRPC server.
type DecryptClient interface {
	Decrypt(ctx context.Context, namespace string, names []string) (map[string]string, error)
}

// DecryptAuthorizer is implemented as a custom authorizer for the gRPC implementation.
type DecryptAuthorizer interface {
	Authorize(ctx context.Context, namespace string, names []string) (authorized authorizer.Decision, reason string, err error)
}
