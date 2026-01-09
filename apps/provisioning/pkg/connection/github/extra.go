package github

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
)

type extra struct {
	factory GithubFactory
}

func (e *extra) Type() provisioning.ConnectionType {
	return provisioning.GithubConnectionType
}

func (e *extra) Build(ctx context.Context, r *provisioning.Connection) (connection.Connection, error) {
	logger := logging.FromContext(ctx)
	if r == nil || r.Spec.GitHub == nil {
		logger.Error("connection is nil or github info is nil")

		return nil, fmt.Errorf("invalid github connection")
	}

	logger = logger.With("appID", r.Spec.GitHub.AppID, "installationID", r.Spec.GitHub.InstallationID)
	logger.Info("Instantiating Github connection")

	ghConnection := NewConnection(ctx, r, e.factory)
	return &ghConnection, nil
}

func Extra(factory GithubFactory) connection.Extra {
	return &extra{
		factory: factory,
	}
}
