package github

import (
	"context"
	"errors"
	"fmt"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository/github"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"k8s.io/apimachinery/pkg/util/validation/field"
)

//go:generate mockery --name GithubFactory --structname MockGithubFactory --inpackage --filename factory_mock.go --with-expecter
type GithubFactory interface {
	New(ctx context.Context, ghToken common.RawSecureValue) Client
}

type ConnectionSecrets struct {
	PrivateKey common.RawSecureValue
	Token      common.RawSecureValue
}

type Connection struct {
	obj       *provisioning.Connection
	ghFactory GithubFactory
	secrets   ConnectionSecrets
}

func NewConnection(
	obj *provisioning.Connection,
	factory GithubFactory,
	secrets ConnectionSecrets,
) Connection {
	return Connection{
		obj:       obj,
		ghFactory: factory,
		secrets:   secrets,
	}
}

const (
	//TODO(ferruvich): these probably need to be setup in API configuration.
	githubInstallationURL = "https://github.com/settings/installations"
	jwtExpirationMinutes  = 10 // GitHub Apps JWT tokens expire in 10 minutes maximum
)

// validateAppAndInstallation validates the appID and installationID against the given github token.
func (c *Connection) validateAppAndInstallation(ctx context.Context) *field.Error {
	ghClient := c.ghFactory.New(ctx, c.secrets.Token)

	app, err := ghClient.GetApp(ctx)
	if err != nil {
		if errors.Is(err, ErrServiceUnavailable) {
			return field.InternalError(field.NewPath("spec", "token"), ErrServiceUnavailable)
		}
		return field.Invalid(field.NewPath("spec", "token"), "[REDACTED]", "invalid token")
	}

	if fmt.Sprintf("%d", app.ID) != c.obj.Spec.GitHub.AppID {
		return field.Invalid(field.NewPath("spec", "appID"), c.obj.Spec.GitHub.AppID, "appID mismatch")
	}

	_, err = ghClient.GetAppInstallation(ctx, c.obj.Spec.GitHub.InstallationID)
	if err != nil {
		if errors.Is(err, ErrServiceUnavailable) {
			return field.InternalError(field.NewPath("spec", "token"), ErrServiceUnavailable)
		}
		return field.Invalid(field.NewPath("spec", "installationID"), c.obj.Spec.GitHub.InstallationID, "invalid installation ID")
	}

	return nil
}

// GenerateRepositoryToken generates a repository-scoped access token.
func (c *Connection) GenerateRepositoryToken(ctx context.Context, repo *provisioning.Repository) (common.RawSecureValue, error) {
	if repo == nil {
		return "", errors.New("a repository is required to generate a token")
	}
	if c.obj.Spec.GitHub == nil {
		return "", errors.New("connection is not a GitHub connection")
	}
	if repo.Spec.GitHub == nil {
		return "", errors.New("repository is not a GitHub repo")
	}

	_, repoName, err := github.ParseOwnerRepoGithub(repo.Spec.GitHub.URL)
	if err != nil {
		return "", fmt.Errorf("failed to parse repo URL: %w", err)
	}

	// Create the GitHub client with the JWT token
	ghClient := c.ghFactory.New(ctx, c.secrets.Token)

	// Create an installation access token scoped to this repository
	installationToken, err := ghClient.CreateInstallationAccessToken(ctx, c.obj.Spec.GitHub.InstallationID, repoName)
	if err != nil {
		return "", fmt.Errorf("failed to create installation access token: %w", err)
	}

	return common.RawSecureValue(installationToken.Token), nil
}

var (
	_ connection.Connection = (*Connection)(nil)
)
