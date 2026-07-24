package oauth

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/util/validation/field"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
)

// DecryptSecrets decrypts the secure values used by OAuth app connections.
func DecryptSecrets(ctx context.Context, decrypter connection.Decrypter, conn *provisioning.Connection) (ConnectionSecrets, error) {
	secure := decrypter(conn)

	clientSecret, err := secure.ClientSecret(ctx)
	if err != nil {
		return ConnectionSecrets{}, fmt.Errorf("decrypt client secret: %w", err)
	}

	token, err := secure.Token(ctx)
	if err != nil {
		return ConnectionSecrets{}, fmt.Errorf("decrypt token: %w", err)
	}

	return ConnectionSecrets{
		ClientSecret: clientSecret,
		Token:        token,
	}, nil
}

// ValidateCredentials performs the structural validation shared by all OAuth
// app connections: the provider section with a clientID and a clientSecret are
// required, a privateKey is forbidden. The connection type doubles as the name
// of the spec field holding the provider configuration.
func ValidateCredentials(conn *provisioning.Connection, connType provisioning.ConnectionType, cfgPresent bool, clientID string) field.ErrorList {
	var errs field.ErrorList
	section := string(connType)

	if !cfgPresent {
		errs = append(
			errs, field.Required(field.NewPath("spec", section), fmt.Sprintf("%s info must be specified in %s connection", section, connType)),
		)
	} else if clientID == "" {
		errs = append(errs, field.Required(field.NewPath("spec", section, "clientID"), fmt.Sprintf("clientID must be specified for %s connection", connType)))
	}

	if conn.Secure.ClientSecret.IsZero() {
		errs = append(errs, field.Required(field.NewPath("secure", "clientSecret"), fmt.Sprintf("clientSecret must be specified for %s connection", connType)))
	}

	if !conn.Secure.PrivateKey.IsZero() {
		errs = append(errs, field.Forbidden(field.NewPath("secure", "privateKey"), fmt.Sprintf("privateKey is forbidden in %s connection", connType)))
	}

	return errs
}
