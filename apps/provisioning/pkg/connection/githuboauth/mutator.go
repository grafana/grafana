package githuboauth

import (
	"context"

	"k8s.io/apimachinery/pkg/runtime"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// Mutate performs in place mutation of the Connection resource.
func Mutate(_ context.Context, obj runtime.Object) error {
	conn, ok := obj.(*provisioning.Connection)
	if !ok {
		return nil
	}

	// Do nothing if connection is not githubOAuth.
	if conn.Spec.Type != provisioning.GithubOAuthConnectionType || conn.Spec.GitHubOAuth == nil {
		return nil
	}

	// Set URL to the GitHub OAuth apps settings page. There is no API to look up
	// the application's numeric ID, so a deep link cannot be derived.
	conn.Spec.URL = "https://github.com/settings/developers"

	return nil
}
