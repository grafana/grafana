package github

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

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
	if c.secrets.Token.IsZero() {
		// In case the token is not generated, we create one on the fly
		// to testing that the other fields are valid.
		token, err := GenerateJWTToken(c.obj.Spec.GitHub.AppID, c.secrets.PrivateKey)
		if err != nil {
			// Error generating JWT token means the privateKey is not valid.
			return &provisioning.TestResults{
				TypeMeta: metav1.TypeMeta{
					APIVersion: provisioning.APIVERSION,
					Kind:       "TestResults",
				},
				Code:    http.StatusUnauthorized,
				Success: false,
				Errors: []provisioning.ErrorDetails{
					{
						Type:   metav1.CauseTypeFieldValueInvalid,
						Field:  field.NewPath("secure", "privateKey").String(),
						Detail: "invalid private key",
					},
				},
			}, nil
		}
		c.obj.Secure.Token.Create = token
		c.secrets.Token = token
	} else {
		// In case the token is there, we verify it's correct.
		claims, err := parseJWTToken(c.secrets.Token, c.secrets.PrivateKey)
		if err != nil {
			// Error parsing JWT token means the given private key is invalid
			return &provisioning.TestResults{
				TypeMeta: metav1.TypeMeta{
					APIVersion: provisioning.APIVERSION,
					Kind:       "TestResults",
				},
				Code:    http.StatusUnauthorized,
				Success: false,
				Errors: []provisioning.ErrorDetails{
					{
						Type:   metav1.CauseTypeFieldValueInvalid,
						Field:  field.NewPath("secure", "privateKey").String(),
						Detail: "invalid private key",
					},
				},
			}, nil
		}
		if claims.Issuer != c.obj.Spec.GitHub.AppID {
			return &provisioning.TestResults{
				TypeMeta: metav1.TypeMeta{
					APIVersion: provisioning.APIVERSION,
					Kind:       "TestResults",
				},
				Code:    http.StatusUnauthorized,
				Success: false,
				Errors: []provisioning.ErrorDetails{
					{
						Type:   metav1.CauseTypeFieldValueInvalid,
						Field:  field.NewPath("spec", "github", "appID").String(),
						Detail: fmt.Sprintf("invalid app ID: %s", c.obj.Spec.GitHub.AppID),
					},
				},
			}, nil
		}
	}

	ghClient := c.ghFactory.New(ctx, c.secrets.Token)

	app, err := ghClient.GetApp(ctx)
	if err != nil {
		// Check for specific error types
		switch {
		case errors.Is(err, ErrAuthentication):
			// ErrAuthentication is returned when the underlying JWT is invalid.
			// This means that appID and/or privateKey are not correct.
			return &provisioning.TestResults{
				TypeMeta: metav1.TypeMeta{
					APIVersion: provisioning.APIVERSION,
					Kind:       "TestResults",
				},
				Code:    http.StatusUnauthorized,
				Success: false,
				Errors: []provisioning.ErrorDetails{
					{
						Type:   metav1.CauseTypeFieldValueInvalid,
						Field:  field.NewPath("spec", "github", "appID").String(),
						Detail: "verify appID is correct",
					},
					{
						Type:   metav1.CauseTypeFieldValueInvalid,
						Field:  field.NewPath("secure", "privateKey").String(),
						Detail: "verify privateKey is correct",
					},
				},
			}, nil
		case errors.Is(err, ErrNotFound):
			return &provisioning.TestResults{
				TypeMeta: metav1.TypeMeta{
					APIVersion: provisioning.APIVERSION,
					Kind:       "TestResults",
				},
				Code:    http.StatusNotFound,
				Success: false,
				Errors: []provisioning.ErrorDetails{
					{
						Type:   metav1.CauseTypeFieldValueNotFound,
						Field:  field.NewPath("spec", "github", "appID").String(),
						Detail: "app not found",
					},
				},
			}, nil
		case errors.Is(err, ErrServiceUnavailable):
			return &provisioning.TestResults{
				TypeMeta: metav1.TypeMeta{
					APIVersion: provisioning.APIVERSION,
					Kind:       "TestResults",
				},
				Code:    http.StatusServiceUnavailable,
				Success: false,
				Errors: []provisioning.ErrorDetails{
					{
						Type:   metav1.CauseTypeInternal,
						Detail: ErrServiceUnavailable.Error(),
					},
				},
			}, nil
		default:
			// Generic error - invalid spec
			return &provisioning.TestResults{
				TypeMeta: metav1.TypeMeta{
					APIVersion: provisioning.APIVERSION,
					Kind:       "TestResults",
				},
				Code:    http.StatusUnprocessableEntity,
				Success: false,
				Errors: []provisioning.ErrorDetails{
					{
						Type:   metav1.CauseTypeFieldValueInvalid,
						Field:  field.NewPath("spec", "github", "appID").String(),
						Detail: "verify appID is correct",
					},
					{
						Type:   metav1.CauseTypeFieldValueInvalid,
						Field:  field.NewPath("secure", "privateKey").String(),
						Detail: "verify privateKey is correct",
					},
				},
			}, nil
		}
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
					Field:  field.NewPath("spec", "github", "appID").String(),
					Detail: fmt.Sprintf("appID mismatch: expected %s, got %d", c.obj.Spec.GitHub.AppID, app.ID),
				},
			},
		}, nil
	}

	_, err = ghClient.GetAppInstallation(ctx, c.obj.Spec.GitHub.InstallationID)
	if err != nil {
		// Check for specific error types
		switch {
		case errors.Is(err, ErrAuthentication):
			return &provisioning.TestResults{
				TypeMeta: metav1.TypeMeta{
					APIVersion: provisioning.APIVERSION,
					Kind:       "TestResults",
				},
				Code:    http.StatusUnauthorized,
				Success: false,
				Errors: []provisioning.ErrorDetails{
					{
						Type:   metav1.CauseTypeFieldValueInvalid,
						Field:  field.NewPath("spec", "github", "installationID").String(),
						Detail: ErrAuthentication.Error(),
					},
				},
			}, nil
		case errors.Is(err, ErrNotFound):
			return &provisioning.TestResults{
				TypeMeta: metav1.TypeMeta{
					APIVersion: provisioning.APIVERSION,
					Kind:       "TestResults",
				},
				Code:    http.StatusNotFound,
				Success: false,
				Errors: []provisioning.ErrorDetails{
					{
						Type:   metav1.CauseTypeFieldValueInvalid,
						Field:  field.NewPath("spec", "github", "installationID").String(),
						Detail: "installation not found",
					},
				},
			}, nil
		case errors.Is(err, ErrServiceUnavailable):
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
						Field:  field.NewPath("spec", "github", "installationID").String(),
						Detail: ErrServiceUnavailable.Error(),
					},
				},
			}, nil
		default:
			// Generic error - invalid spec
			return &provisioning.TestResults{
				TypeMeta: metav1.TypeMeta{
					APIVersion: provisioning.APIVERSION,
					Kind:       "TestResults",
				},
				Code:    http.StatusUnprocessableEntity,
				Success: false,
				Errors: []provisioning.ErrorDetails{
					{
						Type:   metav1.CauseTypeFieldValueInvalid,
						Field:  field.NewPath("spec", "github", "installationID").String(),
						Detail: fmt.Sprintf("invalid installation ID: %s", c.obj.Spec.GitHub.InstallationID),
					},
				},
			}, nil
		}
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
		switch {
		case errors.Is(err, ErrUnprocessableEntity):
			return nil, fmt.Errorf("%s: %w", err.Error(), connection.ErrRepositoryAccess)
		case errors.Is(err, ErrNotFound):
			return nil, fmt.Errorf("%s: %w", err.Error(), connection.ErrNotFound)
		case errors.Is(err, ErrAuthentication):
			return nil, connection.ErrAuthentication
		}

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

	token, err := ghClient.CreateInstallationAccessToken(ctx, c.obj.Spec.GitHub.InstallationID, "")
	if err != nil {
		return nil, fmt.Errorf("failed to create installation access token: %w", err)
	}

	installationGhClient := c.ghFactory.New(ctx, common.RawSecureValue(token.Token))

	repos, err := installationGhClient.ListInstallationRepositories(ctx)
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

// GenerateConnectionToken generates a JWT token for GitHub App authentication.
// Implements the connection.TokenConnection interface.
func (c *Connection) GenerateConnectionToken(_ context.Context) (common.RawSecureValue, error) {
	if c.obj.Spec.GitHub == nil {
		return "", errors.New("connection is not a GitHub connection")
	}

	return GenerateJWTToken(c.obj.Spec.GitHub.AppID, c.secrets.PrivateKey)
}

// TokenCreationTime returns when the underlying token has been created.
func (c *Connection) TokenCreationTime(_ context.Context) (time.Time, error) {
	issuingTime, _, err := getIssuingAndExpirationTimeFromToken(c.secrets.Token, c.secrets.PrivateKey)
	if err != nil {
		return time.Time{}, err
	}

	return issuingTime, nil
}

// TokenExpiration returns the underlying token expiration.
func (c *Connection) TokenExpiration(_ context.Context) (time.Time, error) {
	_, expiration, err := getIssuingAndExpirationTimeFromToken(c.secrets.Token, c.secrets.PrivateKey)
	if err != nil {
		return time.Time{}, err
	}

	return expiration, nil
}

// TokenValid returns whether the underlying token is valid.
func (c *Connection) TokenValid(_ context.Context) bool {
	claims, err := parseJWTToken(c.secrets.Token, c.secrets.PrivateKey)
	if err != nil {
		// Error here means the token has not been built with the object privateKey
		return false
	}

	// For the token to be valid, the issuer must be equal to the object appID
	return claims.Issuer == c.obj.Spec.GitHub.AppID
}

var (
	_ connection.Connection      = (*Connection)(nil)
	_ connection.TokenConnection = (*Connection)(nil)
)
