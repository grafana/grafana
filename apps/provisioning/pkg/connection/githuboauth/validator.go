package githuboauth

import (
	"context"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/validation/field"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection/oauth"
)

// Validate validates the githubOAuth connection configuration without requiring decrypted secrets.
// This performs structural validation only - it does not verify the connection works.
func Validate(_ context.Context, obj runtime.Object) field.ErrorList {
	conn, ok := obj.(*provisioning.Connection)
	if !ok {
		return nil
	}

	// Do nothing if connection is not githubOAuth.
	if conn.Spec.Type != provisioning.GithubOAuthConnectionType {
		return nil
	}

	var clientID string
	if conn.Spec.GitHubOAuth != nil {
		clientID = conn.Spec.GitHubOAuth.ClientID
	}

	return oauth.ValidateCredentials(conn, "GitHub OAuth", "githubOAuth", conn.Spec.GitHubOAuth != nil, clientID)
}
