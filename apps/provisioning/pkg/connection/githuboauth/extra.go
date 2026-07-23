package githuboauth

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/validation/field"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection/oauth"
)

type extra struct {
	decrypter connection.Decrypter
}

func Extra(decrypter connection.Decrypter) connection.Extra {
	return &extra{decrypter: decrypter}
}

func (e *extra) Type() provisioning.ConnectionType {
	return provisioning.GithubOAuthConnectionType
}

func (e *extra) Build(ctx context.Context, conn *provisioning.Connection) (connection.Connection, error) {
	if conn == nil || conn.Spec.GitHubOAuth == nil {
		return nil, fmt.Errorf("githubOAuth configuration is required")
	}

	secrets, err := oauth.DecryptSecrets(ctx, e.decrypter, conn)
	if err != nil {
		return nil, err
	}

	c := oauth.NewConnection(conn, &Provider{clientID: conn.Spec.GitHubOAuth.ClientID}, secrets)
	return &c, nil
}

func (e *extra) Mutate(_ context.Context, _ runtime.Object) error {
	return nil
}

func (e *extra) Validate(_ context.Context, obj runtime.Object) field.ErrorList {
	conn, ok := obj.(*provisioning.Connection)
	if !ok || conn.Spec.Type != provisioning.GithubOAuthConnectionType {
		return nil
	}

	var clientID string
	if conn.Spec.GitHubOAuth != nil {
		clientID = conn.Spec.GitHubOAuth.ClientID
	}

	return oauth.ValidateCredentials(conn, provisioning.GithubOAuthConnectionType, conn.Spec.GitHubOAuth != nil, clientID)
}
