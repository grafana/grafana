package connection

import (
	"fmt"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

const (
	githubInstallationURL = "https://github.com/settings/installations"
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
		return nil
	default:
		// TODO: we need to setup the URL for bitbucket and gitlab.
		return nil
	}
}
