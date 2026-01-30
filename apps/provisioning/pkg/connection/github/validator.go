package github

import (
	"context"
	"encoding/base64"
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

	// Check if required secure values are present (without decryption)
	if conn.Secure.PrivateKey.IsZero() {
		list = append(list, field.Required(field.NewPath("secure", "privateKey"), "privateKey must be specified for GitHub connection"))
	}
	if !conn.Secure.ClientSecret.IsZero() {
		list = append(list, field.Forbidden(field.NewPath("secure", "clientSecret"), "clientSecret is forbidden in GitHub connection"))
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

	// Validate the existence of GitHub configuration fields
	if conn.Spec.GitHub.AppID == "" {
		list = append(list, field.Required(field.NewPath("spec", "github", "appID"), "appID must be specified for GitHub connection"))
	}
	if conn.Spec.GitHub.InstallationID == "" {
		list = append(list, field.Required(field.NewPath("spec", "github", "installationID"), "installationID must be specified for GitHub connection"))
	}

	// Validating the correctness of Github config fields
	_, err := strconv.Atoi(conn.Spec.GitHub.AppID)
	if err != nil {
		list = append(list, field.Invalid(field.NewPath("spec", "github", "appID"), conn.Spec.GitHub.AppID, "appID must be a numeric value"))
	}
	_, err = strconv.Atoi(conn.Spec.GitHub.InstallationID)
	if err != nil {
		list = append(list, field.Invalid(field.NewPath("spec", "github", "installationID"), conn.Spec.GitHub.InstallationID, "installationID must be a numeric value"))
	}

	return list
}
