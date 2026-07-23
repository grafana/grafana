package oauth

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/validation/field"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
)

// ProviderFromConnection resolves the provider and clientID from the
// type-specific section of the connection spec. It returns ok=false when that
// section is missing.
type ProviderFromConnection = func(c *provisioning.Connection) (provider Provider, clientID string, ok bool)

type extra struct {
	decrypter connection.Decrypter
	connType  provisioning.ConnectionType
	from      ProviderFromConnection
	mutate    func(ctx context.Context, obj runtime.Object) error
	validate  func(ctx context.Context, obj runtime.Object) field.ErrorList
}

// Extra builds a connection.Extra shared by all OAuth app connection types.
func Extra(
	decrypter connection.Decrypter,
	connType provisioning.ConnectionType,
	from ProviderFromConnection,
	mutate func(ctx context.Context, obj runtime.Object) error,
	validate func(ctx context.Context, obj runtime.Object) field.ErrorList,
) connection.Extra {
	return &extra{
		decrypter: decrypter,
		connType:  connType,
		from:      from,
		mutate:    mutate,
		validate:  validate,
	}
}

func (e *extra) Type() provisioning.ConnectionType {
	return e.connType
}

func (e *extra) Build(ctx context.Context, conn *provisioning.Connection) (connection.Connection, error) {
	logger := logging.FromContext(ctx)
	if conn == nil {
		logger.Error("connection is nil", "type", e.connType)

		return nil, fmt.Errorf("invalid %s connection", e.connType)
	}

	provider, clientID, ok := e.from(conn)
	if !ok {
		logger.Error("connection is missing its provider configuration", "type", e.connType)

		return nil, fmt.Errorf("invalid %s connection", e.connType)
	}

	// Decrypt secure values
	secure := e.decrypter(conn)

	// Decrypt client secret
	clientSecret, err := secure.ClientSecret(ctx)
	if err != nil {
		logger.Error("Failed to decrypt client secret", "error", err)

		return nil, err
	}

	// Decrypt token
	token, err := secure.Token(ctx)
	if err != nil {
		logger.Error("Failed to decrypt token", "error", err)

		return nil, err
	}

	c := NewConnection(conn, provider, clientID, ConnectionSecrets{
		ClientSecret: clientSecret,
		Token:        token,
	})
	return &c, nil
}

func (e *extra) Mutate(ctx context.Context, obj runtime.Object) error {
	return e.mutate(ctx, obj)
}

func (e *extra) Validate(ctx context.Context, obj runtime.Object) field.ErrorList {
	return e.validate(ctx, obj)
}
