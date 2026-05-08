package github

import (
	"context"
	"encoding/base64"
	"fmt"
	"strconv"

	"github.com/golang-jwt/jwt/v4"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/validation/field"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// Validate validates the github connection configuration without requiring decrypted secrets.
// This performs structural validation only - it does not verify the connection works.
func Validate(_ context.Context, obj runtime.Object) field.ErrorList {
	conn, ok := obj.(*provisioning.Connection)
	if !ok {
		return nil
	}

	// Do nothing if connection is not github.
	if conn.Spec.Type != provisioning.GithubConnectionType {
		return nil
	}

	var list field.ErrorList

	if conn.Spec.GitHub == nil {
		list = append(
			list, field.Required(field.NewPath("spec", "github"), "github info must be specified for GitHub connection"),
		)

		// Doesn't make much sense to continue validating a connection with no information.
		return list
	}

	list = append(list, ValidateGitHubAppCredentials(conn, "GitHub", conn.Spec.GitHub.AppID, conn.Spec.GitHub.InstallationID, field.NewPath("spec", "github"))...)
	return list
}

// ValidateGitHubAppCredentials performs structural validation of the GitHub App credential
// fields shared by github and githubEnterprise connections. label is interpolated into
// error messages (e.g. "GitHub", "GitHub Enterprise") so the source of the violation is
// clear. basePath is the field path of the spec section holding the credentials
// (e.g. spec.github or spec.githubEnterprise).
func ValidateGitHubAppCredentials(conn *provisioning.Connection, label, appID, installationID string, basePath *field.Path) field.ErrorList {
	var list field.ErrorList

	// Check if required secure values are present (without decryption)
	if conn.Secure.PrivateKey.IsZero() {
		list = append(list, field.Required(field.NewPath("secure", "privateKey"), fmt.Sprintf("privateKey must be specified for %s connection", label)))
	}
	if !conn.Secure.ClientSecret.IsZero() {
		list = append(list, field.Forbidden(field.NewPath("secure", "clientSecret"), fmt.Sprintf("clientSecret is forbidden in %s connection", label)))
	}

	// Validate private key content if new is provided
	if !conn.Secure.PrivateKey.Create.IsZero() {
		// Decode base64-encoded private key
		privateKeyPEM, err := base64.StdEncoding.DecodeString(string(conn.Secure.PrivateKey.Create))
		if err != nil {
			list = append(list, field.Invalid(field.NewPath("secure", "privateKey"), "[REDACTED]", "privateKey must be base64 encoded"))
		} else {
			// Parse the private key
			_, err := jwt.ParseRSAPrivateKeyFromPEM(privateKeyPEM)
			if err != nil {
				list = append(list, field.Invalid(field.NewPath("secure", "privateKey"), "[REDACTED]", "privateKey must be a valid RSA private key"))
			}
		}
	}

	// Validate the existence and correctness of GitHub configuration fields.
	// Skip the numeric check on empty values to avoid emitting both Required and Invalid for the same field.
	if appID == "" {
		list = append(list, field.Required(basePath.Child("appID"), fmt.Sprintf("appID must be specified for %s connection", label)))
	} else if _, err := strconv.Atoi(appID); err != nil {
		list = append(list, field.Invalid(basePath.Child("appID"), appID, "appID must be a numeric value"))
	}
	if installationID == "" {
		list = append(list, field.Required(basePath.Child("installationID"), fmt.Sprintf("installationID must be specified for %s connection", label)))
	} else if _, err := strconv.Atoi(installationID); err != nil {
		list = append(list, field.Invalid(basePath.Child("installationID"), installationID, "installationID must be a numeric value"))
	}

	return list
}
