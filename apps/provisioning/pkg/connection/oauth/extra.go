package oauth

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/validation/field"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
)

// NewProviderFunc constructs the provider-specific parts of an OAuth app
// connection from the connection spec.
type NewProviderFunc func(spec provisioning.ConnectionSpec) Provider

// ValidateSpecFunc performs provider-specific spec validation. The shared
// oauth section and secure values are validated by the extra itself. May be
// nil when the provider has no extra spec fields.
type ValidateSpecFunc func(spec provisioning.ConnectionSpec) field.ErrorList

// NewExtra builds the connection.Extra shared by all OAuth app connections.
func NewExtra(
	decrypter connection.Decrypter,
	connType provisioning.ConnectionType,
	repoType provisioning.RepositoryType,
	newProvider NewProviderFunc,
	validateSpec ValidateSpecFunc,
) connection.Extra {
	return &extra{
		decrypter:    decrypter,
		connType:     connType,
		repoType:     repoType,
		newProvider:  newProvider,
		validateSpec: validateSpec,
	}
}

type extra struct {
	decrypter    connection.Decrypter
	connType     provisioning.ConnectionType
	repoType     provisioning.RepositoryType
	newProvider  NewProviderFunc
	validateSpec ValidateSpecFunc
}

func (e *extra) Type() provisioning.ConnectionType {
	return e.connType
}

func (e *extra) Build(ctx context.Context, conn *provisioning.Connection) (connection.Connection, error) {
	if conn == nil || conn.Spec.OAuth == nil {
		return nil, fmt.Errorf("oauth configuration is required")
	}

	secure := e.decrypter(conn)

	clientSecret, err := secure.ClientSecret(ctx)
	if err != nil {
		return nil, fmt.Errorf("decrypt client secret: %w", err)
	}

	token, err := secure.Token(ctx)
	if err != nil {
		return nil, fmt.Errorf("decrypt token: %w", err)
	}

	secrets := ConnectionSecrets{
		ClientSecret: clientSecret,
		Token:        token,
	}

	c := NewConnection(e.newProvider(conn.Spec), e.repoType, *conn.Spec.OAuth, secrets)
	return &c, nil
}

func (e *extra) Mutate(_ context.Context, _ runtime.Object) error {
	return nil
}

func (e *extra) Validate(_ context.Context, obj runtime.Object) field.ErrorList {
	conn, ok := obj.(*provisioning.Connection)
	if !ok || conn.Spec.Type != e.connType {
		return nil
	}

	var errs field.ErrorList
	if conn.Spec.OAuth == nil {
		errs = append(errs, field.Required(field.NewPath("spec", "oauth"), "oauth info must be specified for OAuth app connections"))
	} else if conn.Spec.OAuth.ClientID == "" {
		errs = append(errs, field.Required(field.NewPath("spec", "oauth", "clientID"), "clientID must be specified for OAuth app connections"))
	}

	if conn.Secure.ClientSecret.IsZero() {
		errs = append(errs, field.Required(field.NewPath("secure", "clientSecret"), "clientSecret must be specified for OAuth app connections"))
	}

	if !conn.Secure.PrivateKey.IsZero() {
		errs = append(errs, field.Forbidden(field.NewPath("secure", "privateKey"), "privateKey is forbidden in OAuth app connections"))
	}

	if e.validateSpec != nil {
		errs = append(errs, e.validateSpec(conn.Spec)...)
	}
	return errs
}
