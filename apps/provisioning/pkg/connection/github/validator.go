package github

import (
	"context"

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
	if conn.Secure.Token.IsZero() {
		list = append(list, field.Required(field.NewPath("secure", "token"), "token must be specified for GitHub connection"))
	}
	if !conn.Secure.ClientSecret.IsZero() {
		list = append(list, field.Forbidden(field.NewPath("secure", "clientSecret"), "clientSecret is forbidden in GitHub connection"))
	}

	// Validate GitHub configuration fields
	if conn.Spec.GitHub.AppID == "" {
		list = append(list, field.Required(field.NewPath("spec", "github", "appID"), "appID must be specified for GitHub connection"))
	}
	if conn.Spec.GitHub.InstallationID == "" {
		list = append(list, field.Required(field.NewPath("spec", "github", "installationID"), "installationID must be specified for GitHub connection"))
	}

	return list
}
