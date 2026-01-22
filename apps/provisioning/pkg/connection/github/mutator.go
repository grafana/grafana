package github

import (
	"context"
	"fmt"

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
		token, err := GenerateJWTToken(conn.Spec.GitHub.AppID, conn.Secure.PrivateKey.Create)
		if err != nil {
			return fmt.Errorf("failed to generate JWT token: %w", err)
		}
		// Store the generated token
		conn.Secure.Token = common.InlineSecureValue{Create: token}
	}

	return nil
}
