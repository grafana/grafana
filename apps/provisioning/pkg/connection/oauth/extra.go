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
	validate  func(conn *provisioning.Connection) field.ErrorList
}

// Extra builds a connection.Extra shared by all OAuth app connection types.
// Mutation (defaulting spec.URL to the provider's app management page) and
// structural credential validation are handled here; validate optionally adds
// type-specific checks.
func Extra(
	decrypter connection.Decrypter,
	connType provisioning.ConnectionType,
	from ProviderFromConnection,
	validate func(conn *provisioning.Connection) field.ErrorList,
) connection.Extra {
	return &extra{
		decrypter: decrypter,
		connType:  connType,
		from:      from,
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

func (e *extra) Mutate(_ context.Context, obj runtime.Object) error {
	conn, ok := obj.(*provisioning.Connection)
	if !ok || conn.Spec.Type != e.connType {
		return nil
	}

	provider, _, ok := e.from(conn)
	if !ok {
		return nil
	}

	if conn.Spec.URL == "" {
		conn.Spec.URL = provider.AppURL
	}

	return nil
}

func (e *extra) Validate(_ context.Context, obj runtime.Object) field.ErrorList {
	conn, ok := obj.(*provisioning.Connection)
	if !ok || conn.Spec.Type != e.connType {
		return nil
	}

	_, clientID, cfgPresent := e.from(conn)

	list := validateCredentials(conn, e.connType, cfgPresent, clientID)
	if e.validate != nil {
		list = append(list, e.validate(conn)...)
	}

	return list
}

// validateCredentials performs the structural validation shared by all OAuth
// app connections: the provider section with a clientID and a clientSecret are
// required, a privateKey is forbidden. The connection type doubles as the name
// of the spec field holding the provider configuration.
func validateCredentials(conn *provisioning.Connection, connType provisioning.ConnectionType, cfgPresent bool, clientID string) field.ErrorList {
	var list field.ErrorList
	section := string(connType)

	if !cfgPresent {
		list = append(
			list, field.Required(field.NewPath("spec", section), fmt.Sprintf("%s info must be specified in %s connection", section, connType)),
		)
	} else if clientID == "" {
		list = append(list, field.Required(field.NewPath("spec", section, "clientID"), fmt.Sprintf("clientID must be specified for %s connection", connType)))
	}

	if conn.Secure.ClientSecret.IsZero() {
		list = append(list, field.Required(field.NewPath("secure", "clientSecret"), fmt.Sprintf("clientSecret must be specified for %s connection", connType)))
	}

	if !conn.Secure.PrivateKey.IsZero() {
		list = append(list, field.Forbidden(field.NewPath("secure", "privateKey"), fmt.Sprintf("privateKey is forbidden in %s connection", connType)))
	}

	return list
}
