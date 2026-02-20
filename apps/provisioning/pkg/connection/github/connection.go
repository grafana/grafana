package github

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/validation/field"

	"github.com/grafana/grafana-app-sdk/logging"
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
	logger := logging.FromContext(ctx)

	// If given token doesn't exists, or the privateKey is being renewed, we need to generate a new token for testing.
	if c.secrets.Token.IsZero() || !c.obj.Secure.PrivateKey.Create.IsZero() {
		// In case the token is not generated, we create one on the fly
		// to testing that the other fields are valid.
		token, err := GenerateJWTToken(c.obj.Spec.GitHub.AppID, c.secrets.PrivateKey)
		if err != nil {
			// Error generating JWT token means the privateKey is not valid.
			logger.Info("JWT token generation failed during connection test", "appID", c.obj.Spec.GitHub.AppID)
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
			logger.Info("JWT token parsing failed during connection test", "appID", c.obj.Spec.GitHub.AppID)
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
			logger.Info("JWT issuer mismatch", "expected", c.obj.Spec.GitHub.AppID, "got", claims.Issuer)
			return &provisioning.TestResults{
				TypeMeta: metav1.TypeMeta{
					APIVersion: provisioning.APIVERSION,
					Kind:       "TestResults",
				},
				Code:    http.StatusUnauthorized,
				Success: false,
				Errors: []provisioning.ErrorDetails{
					{
						Type:     metav1.CauseTypeFieldValueInvalid,
						Field:    field.NewPath("spec", "github", "appID").String(),
						Detail:   "invalid app ID",
						BadValue: c.obj.Spec.GitHub.AppID,
					},
				},
			}, nil
		}
	}

	ghClient := c.ghFactory.New(ctx, c.secrets.Token)

	app, err := ghClient.GetApp(ctx)
	if err != nil {
		logger.Info("error getting app", "error", err)

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
						Type:     metav1.CauseTypeFieldValueInvalid,
						Field:    field.NewPath("spec", "github", "appID").String(),
						Detail:   "verify appID is correct",
						BadValue: c.obj.Spec.GitHub.AppID,
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
						Type:     metav1.CauseTypeFieldValueNotFound,
						Field:    field.NewPath("spec", "github", "appID").String(),
						Detail:   "app not found",
						BadValue: c.obj.Spec.GitHub.AppID,
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
						Type:     metav1.CauseTypeFieldValueInvalid,
						Field:    field.NewPath("spec", "github", "appID").String(),
						Detail:   "verify appID is correct",
						BadValue: c.obj.Spec.GitHub.AppID,
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
		logger.Info("app ID mismatch", "expected", c.obj.Spec.GitHub.AppID, "got", app.ID)
		return &provisioning.TestResults{
			TypeMeta: metav1.TypeMeta{
				APIVersion: provisioning.APIVERSION,
				Kind:       "TestResults",
			},
			Code:    http.StatusBadRequest,
			Success: false,
			Errors: []provisioning.ErrorDetails{
				{
					Type:     metav1.CauseTypeFieldValueInvalid,
					Field:    field.NewPath("spec", "github", "appID").String(),
					Detail:   "appID mismatch",
					BadValue: c.obj.Spec.GitHub.AppID,
				},
			},
		}, nil
	}

	// Validate the app's permissions.
	permissionErrors := validatePermissions(permissionTargetApp, c.obj.Spec.GitHub.AppID, app.Permissions)
	if len(permissionErrors) > 0 {
		logger.Info("GitHub App permission validation failed", "appID", c.obj.Spec.GitHub.AppID, "errorCount", len(permissionErrors))
		return &provisioning.TestResults{
			TypeMeta: metav1.TypeMeta{
				APIVersion: provisioning.APIVERSION,
				Kind:       "TestResults",
			},
			Code:    http.StatusForbidden,
			Success: false,
			Errors:  permissionErrors,
		}, nil
	}

	installation, err := ghClient.GetAppInstallation(ctx, c.obj.Spec.GitHub.InstallationID)
	if err != nil {
		logger.Info("error getting app installation", "installationID", c.obj.Spec.GitHub.InstallationID, "error", err)
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
						Type:     metav1.CauseTypeFieldValueInvalid,
						Field:    field.NewPath("spec", "github", "installationID").String(),
						Detail:   ErrAuthentication.Error(),
						BadValue: c.obj.Spec.GitHub.InstallationID,
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
						Type:     metav1.CauseTypeFieldValueInvalid,
						Field:    field.NewPath("spec", "github", "installationID").String(),
						Detail:   "installation not found",
						BadValue: c.obj.Spec.GitHub.InstallationID,
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
						Type:     metav1.CauseTypeFieldValueInvalid,
						Field:    field.NewPath("spec", "github", "installationID").String(),
						Detail:   ErrServiceUnavailable.Error(),
						BadValue: c.obj.Spec.GitHub.InstallationID,
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
						Type:     metav1.CauseTypeFieldValueInvalid,
						Field:    field.NewPath("spec", "github", "installationID").String(),
						Detail:   "invalid installation ID",
						BadValue: c.obj.Spec.GitHub.InstallationID,
					},
				},
			}, nil
		}
	}

	// Validate that the installation has accepted the required permissions.
	// Installation permissions may lag behind App permissions when the App owner added new
	// permissions but the installation owner has not yet accepted them on GitHub.
	installationPermErrors := validatePermissions(permissionTargetInstallation, c.obj.Spec.GitHub.InstallationID, installation.Permissions)
	if len(installationPermErrors) > 0 {
		return &provisioning.TestResults{
			TypeMeta: metav1.TypeMeta{
				APIVersion: provisioning.APIVERSION,
				Kind:       "TestResults",
			},
			Code:    http.StatusForbidden,
			Success: false,
			Errors:  installationPermErrors,
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

type permissionTarget int

const (
	permissionTargetApp permissionTarget = iota
	permissionTargetInstallation
)

// validatePermissions checks if the given app or installation has required permissions.
// For installations, permissions may differ from App permissions when the App's permissions
// were updated but the installation owner has not yet accepted them on GitHub.
func validatePermissions(target permissionTarget, id string, permissions Permissions) []provisioning.ErrorDetails {
	var errs []provisioning.ErrorDetails

	requiredPerms := map[string]struct {
		current  Permission
		required Permission
	}{
		"contents": {
			current:  permissions.Contents,
			required: PermissionWrite,
		},
		"metadata": {
			current:  permissions.Metadata,
			required: PermissionRead,
		},
		"pull_requests": {
			current:  permissions.PullRequests,
			required: PermissionWrite,
		},
		"webhooks": {
			current:  permissions.Webhooks,
			required: PermissionWrite,
		},
	}

	for name, perm := range requiredPerms {
		if perm.current < perm.required {
			var detail string
			var fieldPath string

			switch target {
			case permissionTargetApp:
				detail = fmt.Sprintf(
					"GitHub App lacks required '%s' permission: requires '%s', has '%s'",
					name,
					toAppPermissionString(perm.required),
					toAppPermissionString(perm.current),
				)
				fieldPath = field.NewPath("spec", "github", "appID").String()
			case permissionTargetInstallation:
				detail = fmt.Sprintf(
					"GitHub App installation lacks required '%s' permission: requires '%s', has '%s'. Accept the updated permissions at %s/%s",
					name,
					toAppPermissionString(perm.required),
					toAppPermissionString(perm.current),
					githubInstallationURL,
					id,
				)
				fieldPath = field.NewPath("spec", "github", "installationID").String()
			}

			errs = append(errs, provisioning.ErrorDetails{
				Type:     metav1.CauseTypeForbidden,
				Field:    fieldPath,
				Detail:   detail,
				BadValue: id,
			})
		}
	}

	return errs
}

func toAppPermissionString(permissions Permission) string {
	switch permissions {
	case PermissionNone:
		return ""
	case PermissionRead:
		return "read"
	case PermissionWrite:
		return "write"
	}

	return ""
}

var (
	_ connection.Connection      = (*Connection)(nil)
	_ connection.TokenConnection = (*Connection)(nil)
)
