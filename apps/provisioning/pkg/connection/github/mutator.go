package github

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/runtime"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
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

	return nil
}
