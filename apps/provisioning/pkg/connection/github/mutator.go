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
	if conn.Spec.Type != provisioning.ConnectionTypeGithub || conn.Spec.Github == nil {
		return nil
	}

	// Set URL from GitHub installation
	conn.Spec.Url = fmt.Sprintf("https://github.com/settings/installations/%s", conn.Spec.Github.InstallationID)

	return nil
}
