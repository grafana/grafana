package github

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
)

type extra struct {
	factory   GithubFactory
	decrypter connection.Decrypter
}

func (e *extra) Type() provisioning.ConnectionType {
	return provisioning.GithubConnectionType
}

func (e *extra) Build(ctx context.Context, conn *provisioning.Connection) (connection.Connection, error) {
	logger := logging.FromContext(ctx)
	if conn == nil || conn.Spec.GitHub == nil {
		logger.Error("connection is nil or github info is nil")

		return nil, fmt.Errorf("invalid github connection")
	}

	// Decrypt secure values
	secure := e.decrypter(conn)

	// Decrypt private key
	pKey, err := secure.PrivateKey(ctx)
	if err != nil {
		logger.Error("Failed to decrypt private key", "error", err)

		return nil, err
	}

	// Decrypt token
	t, err := secure.Token(ctx)
	if err != nil {
		logger.Error("Failed to decrypt token", "error", err)

		return nil, err
	}

	c := NewConnection(conn, e.factory, ConnectionSecrets{
		PrivateKey: pKey,
		Token:      t,
	})
	return &c, nil
}

func (e *extra) Mutate(ctx context.Context, obj runtime.Object) error {
	return Mutate(ctx, obj)
}

func Extra(decrypter connection.Decrypter, factory GithubFactory) connection.Extra {
	return &extra{
		decrypter: decrypter,
		factory:   factory,
	}
}
