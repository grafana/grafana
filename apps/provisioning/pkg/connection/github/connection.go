package github

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/validation/field"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository/github"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
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
)

// Test validates the appID and installationID against the given github token.
func (c *Connection) Test(ctx context.Context) (*provisioning.TestResults, error) {
	ghClient := c.ghFactory.New(ctx, c.secrets.Token)

	app, err := ghClient.GetApp(ctx)
	if err != nil {
		if errors.Is(err, ErrServiceUnavailable) {
			return &provisioning.TestResults{
				TypeMeta: metav1.TypeMeta{
					APIVersion: provisioning.APIVERSION,
					Kind:       "TestResults",
				},
				Code:    http.StatusServiceUnavailable,
				Success: false,
				Errors: []provisioning.ErrorDetails{
					{
						Type:   metav1.CauseTypeFieldValueInvalid,
						Field:  field.NewPath("spec", "token").String(),
						Detail: ErrServiceUnavailable.Error(),
					},
				},
			}, nil
		}
		return &provisioning.TestResults{
			TypeMeta: metav1.TypeMeta{
				APIVersion: provisioning.APIVERSION,
				Kind:       "TestResults",
			},
			Code:    http.StatusBadRequest,
			Success: false,
			Errors: []provisioning.ErrorDetails{
				{
					Type:   metav1.CauseTypeFieldValueInvalid,
					Field:  field.NewPath("spec", "token").String(),
					Detail: "invalid token",
				},
			},
		}, nil
	}

	if fmt.Sprintf("%d", app.ID) != c.obj.Spec.GitHub.AppID {
		return &provisioning.TestResults{
			TypeMeta: metav1.TypeMeta{
				APIVersion: provisioning.APIVERSION,
				Kind:       "TestResults",
			},
			Code:    http.StatusBadRequest,
			Success: false,
			Errors: []provisioning.ErrorDetails{
				{
					Type:   metav1.CauseTypeFieldValueInvalid,
					Field:  field.NewPath("spec", "appID").String(),
					Detail: fmt.Sprintf("appID mismatch: expected %s, got %d", c.obj.Spec.GitHub.AppID, app.ID),
				},
			},
		}, nil
	}

	_, err = ghClient.GetAppInstallation(ctx, c.obj.Spec.GitHub.InstallationID)
	if err != nil {
		if errors.Is(err, ErrServiceUnavailable) {
			return &provisioning.TestResults{
				TypeMeta: metav1.TypeMeta{
					APIVersion: provisioning.APIVERSION,
					Kind:       "TestResults",
				},
				Code:    http.StatusServiceUnavailable,
				Success: false,
				Errors: []provisioning.ErrorDetails{
					{
						Type:   metav1.CauseTypeFieldValueInvalid,
						Field:  field.NewPath("spec", "token").String(),
						Detail: ErrServiceUnavailable.Error(),
					},
				},
			}, nil
		}
		return &provisioning.TestResults{
			TypeMeta: metav1.TypeMeta{
				APIVersion: provisioning.APIVERSION,
				Kind:       "TestResults",
			},
			Code:    http.StatusBadRequest,
			Success: false,
			Errors: []provisioning.ErrorDetails{
				{
					Type:   metav1.CauseTypeFieldValueInvalid,
					Field:  field.NewPath("spec", "installationID").String(),
					Detail: fmt.Sprintf("invalid installation ID: %s", c.obj.Spec.GitHub.InstallationID),
				},
			},
		}, nil
	}

	return &provisioning.TestResults{
		TypeMeta: metav1.TypeMeta{
			APIVersion: provisioning.APIVERSION,
			Kind:       "TestResults",
		},
		Code:    http.StatusOK,
		Success: true,
	}, nil
}

// GenerateConnectionToken generates a JWT token for GitHub App authentication.
// Implements the connection.TokenGenerator interface.
func (c *Connection) GenerateConnectionToken(ctx context.Context) (common.RawSecureValue, error) {
	if c.obj.Spec.GitHub == nil {
		return "", errors.New("connection is not a GitHub connection")
	}

	return GenerateJWTToken(c.obj.Spec.GitHub.AppID, c.secrets.PrivateKey)
}

// GenerateRepositoryToken generates a repository-scoped access token.
func (c *Connection) GenerateRepositoryToken(ctx context.Context, repo *provisioning.Repository) (*connection.ExpirableSecureValue, error) {
	if repo == nil {
		return nil, errors.New("a repository is required to generate a token")
	}
	if c.obj.Spec.GitHub == nil {
		return nil, errors.New("connection is not a GitHub connection")
	}
	if repo.Spec.GitHub == nil {
		return nil, errors.New("repository is not a GitHub repo")
	}

	_, repoName, err := github.ParseOwnerRepoGithub(repo.Spec.GitHub.URL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse repo URL: %w", err)
	}

	// Create the GitHub client with the JWT token
	ghClient := c.ghFactory.New(ctx, c.secrets.Token)

	// Create an installation access token scoped to this repository
	installationToken, err := ghClient.CreateInstallationAccessToken(ctx, c.obj.Spec.GitHub.InstallationID, repoName)
	if err != nil {
		return nil, fmt.Errorf("failed to create installation access token: %w", err)
	}

	return &connection.ExpirableSecureValue{
		Token:     common.RawSecureValue(installationToken.Token),
		ExpiresAt: installationToken.ExpiresAt,
	}, nil
}

// ListRepositories returns the list of repositories accessible through this GitHub App connection.
func (c *Connection) ListRepositories(ctx context.Context) ([]provisioning.ExternalRepository, error) {
	if c.obj.Spec.GitHub == nil {
		return nil, fmt.Errorf("github configuration is required")
	}

	// Create the GitHub client with the JWT token
	ghClient := c.ghFactory.New(ctx, c.secrets.Token)

	repos, err := ghClient.ListInstallationRepositories(ctx, c.obj.Spec.GitHub.InstallationID)
	if err != nil {
		return nil, fmt.Errorf("list installation repositories: %w", err)
	}

	result := make([]provisioning.ExternalRepository, 0, len(repos))
	for _, repo := range repos {
		result = append(result, provisioning.ExternalRepository{
			Name:  repo.Name,
			Owner: repo.Owner,
			URL:   repo.URL,
		})
	}

	return result, nil
}

var (
	_ connection.Connection      = (*Connection)(nil)
	_ connection.TokenGenerator = (*Connection)(nil)
)
