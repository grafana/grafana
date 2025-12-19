package connection

import (
	"encoding/base64"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v4"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

const (
	githubInstallationURL = "https://github.com/settings/installations"

	//TODO(ferruvich): this probably needs to be setup in API configuration.
	jwtExpirationMinutes = 10 // GitHub Apps JWT tokens expire in 10 minutes maximum
)

func MutateConnection(connection *provisioning.Connection) error {
	switch connection.Spec.Type {
	case provisioning.GithubConnectionType:
		// Do nothing in case spec.Github is nil.
		// If this field is required, we should fail at validation time.
		if connection.Spec.GitHub == nil {
			return nil
		}

		connection.Spec.URL = fmt.Sprintf("%s/%s", githubInstallationURL, connection.Spec.GitHub.InstallationID)

		// Generate JWT token if private key is being provided.
		// Same as for the spec.Github, if such a field is required, Validation will take care of that.
		if !connection.Secure.PrivateKey.Create.IsZero() {
			token, err := generateGitHubAppJWT(connection.Spec.GitHub.AppID, connection.Secure.PrivateKey.Create)
			if err != nil {
				return fmt.Errorf("failed to generate JWT token: %w", err)
			}

			// Store the generated token
			connection.Secure.Token = common.InlineSecureValue{Create: token}
		}

		return nil
	default:
		// TODO: we need to setup the URL for bitbucket and gitlab.
		return nil
	}
}

// generateGitHubAppJWT generates a JWT token for GitHub App authentication
// TODO(ferruvich): might be useful to add this into a connection-specific GH library.
func generateGitHubAppJWT(appID string, privateKeyBase64 common.RawSecureValue) (common.RawSecureValue, error) {
	// Decode base64-encoded private key
	privateKeyPEM, err := base64.StdEncoding.DecodeString(string(privateKeyBase64))
	if err != nil {
		return "", fmt.Errorf("failed to decode base64 private key: %w", err)
	}

	// Parse the private key
	key, err := jwt.ParseRSAPrivateKeyFromPEM(privateKeyPEM)
	if err != nil {
		return "", fmt.Errorf("failed to parse private key: %w", err)
	}

	// Create the JWT token
	now := time.Now()
	claims := jwt.RegisteredClaims{
		IssuedAt:  jwt.NewNumericDate(now),
		ExpiresAt: jwt.NewNumericDate(now.Add(time.Duration(jwtExpirationMinutes) * time.Minute)),
		Issuer:    appID,
	}

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	signedToken, err := token.SignedString(key)
	if err != nil {
		return "", fmt.Errorf("failed to sign JWT token: %w", err)
	}

	return common.NewSecretValue(signedToken), nil
}
