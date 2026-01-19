package github

import (
	"context"
	"encoding/base64"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v4"
	"k8s.io/apimachinery/pkg/runtime"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

// Mutate performs in place mutation of the Connection resource.
func Mutate(_ context.Context, obj runtime.Object) error {
	conn, ok := obj.(*provisioning.Connection)
	if !ok {
		return nil
	}

	// Do nothing if connection is not github.
	if conn.Spec.Type != provisioning.GithubConnectionType || conn.Spec.GitHub == nil {
		return nil
	}

	// Set URL from GitHub installation
	conn.Spec.URL = fmt.Sprintf("%s/%s", githubInstallationURL, conn.Spec.GitHub.InstallationID)

	// Generate JWT token if a new private key is being provided.
	if !conn.Secure.PrivateKey.Create.IsZero() {
		token, err := generateToken(conn.Spec.GitHub.AppID, conn.Secure.PrivateKey.Create)
		if err != nil {
			return fmt.Errorf("failed to generate JWT token: %w", err)
		}
		// Store the generated token
		conn.Secure.Token = common.InlineSecureValue{Create: token}
	}

	return nil
}

// Token generates and returns the Connection token.
func generateToken(appID string, privateKey common.RawSecureValue) (common.RawSecureValue, error) {
	// Decode base64-encoded private key
	privateKeyPEM, err := base64.StdEncoding.DecodeString(string(privateKey))
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

	return common.RawSecureValue(signedToken), nil
}
