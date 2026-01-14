package github

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v4"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository/github"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
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

// Mutate performs in place mutation of the underneath resource.
func (c *Connection) Mutate(_ context.Context) error {
	// Do nothing in case spec.Github is nil.
	// If this field is required, we should fail at validation time.
	if c.obj.Spec.GitHub == nil {
		return nil
	}

	c.obj.Spec.URL = fmt.Sprintf("%s/%s", githubInstallationURL, c.obj.Spec.GitHub.InstallationID)

	// Generate JWT token if a new private key is being provided.
	// Same as for the spec.Github, if such a field is required, Validation will take care of that.
	if !c.obj.Secure.PrivateKey.Create.IsZero() {
		token, err := generateToken(c.obj.Spec.GitHub.AppID, c.secrets.PrivateKey)
		if err != nil {
			return fmt.Errorf("failed to generate JWT token: %w", err)
		}
		// Store the generated token
		c.obj.Secure.Token = common.InlineSecureValue{Create: token}
	}

	return nil
}

// Token generates and returns the Connection token.
func generateToken(appID string, privateKey common.RawSecureValue) (common.RawSecureValue, error) {
	// Decode base64-encoded private key
	privateKeyPEM, err := base64.StdEncoding.DecodeString(string(privateKey))
	if err != nil {
		return "", fmt.Errorf("failed to decode base64 private key: %w", err)
	}

	// Parse the private key
	key, err := jwt.ParseRSAPrivateKeyFromPEM(privateKeyPEM)
	if err != nil {
		return "", fmt.Errorf("failed to parse private key: %w", err)
	}

	// Create the JWT token
	now := time.Now()
	claims := jwt.RegisteredClaims{
		IssuedAt:  jwt.NewNumericDate(now),
		ExpiresAt: jwt.NewNumericDate(now.Add(time.Duration(jwtExpirationMinutes) * time.Minute)),
		Issuer:    appID,
	}

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	signedToken, err := token.SignedString(key)
	if err != nil {
		return "", fmt.Errorf("failed to sign JWT token: %w", err)
	}

	return common.RawSecureValue(signedToken), nil
}

// Validate ensures the resource _looks_ correct.
func (c *Connection) Validate(ctx context.Context) error {
	list := field.ErrorList{}

	if c.obj.Spec.Type != provisioning.GithubConnectionType {
		list = append(list, field.Invalid(field.NewPath("spec", "type"), c.obj.Spec.Type, "invalid connection type"))

		// Doesn't make much sense to continue validating a connection which is not a Github one.
		return toError(c.obj.GetName(), list)
	}

	if c.obj.Spec.GitHub == nil {
		list = append(
			list, field.Required(field.NewPath("spec", "github"), "github info must be specified for GitHub connection"),
		)

		// Doesn't make much sense to continue validating a connection with no information.
		return toError(c.obj.GetName(), list)
	}

	if c.secrets.PrivateKey.IsZero() {
		list = append(list, field.Required(field.NewPath("secure", "privateKey"), "privateKey must be specified for GitHub connection"))
	}
	if c.secrets.Token.IsZero() {
		list = append(list, field.Required(field.NewPath("secure", "token"), "token must be specified for GitHub connection"))
	}
	if !c.obj.Secure.ClientSecret.IsZero() {
		list = append(list, field.Forbidden(field.NewPath("secure", "clientSecret"), "clientSecret is forbidden in GitHub connection"))
	}

	// Validate GitHub configuration fields
	if c.obj.Spec.GitHub.AppID == "" {
		list = append(list, field.Required(field.NewPath("spec", "github", "appID"), "appID must be specified for GitHub connection"))
	}
	if c.obj.Spec.GitHub.InstallationID == "" {
		list = append(list, field.Required(field.NewPath("spec", "github", "installationID"), "installationID must be specified for GitHub connection"))
	}

	// In case we have any error above, we don't go forward with the validation, and return the errors.
	if len(list) > 0 {
		return toError(c.obj.GetName(), list)
	}

	// Validating app content via GH API
	if err := c.validateAppAndInstallation(ctx); err != nil {
		list = append(list, err)
	}

	return toError(c.obj.GetName(), list)
}

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

// toError converts a field.ErrorList to an error, returning nil if the list is empty
func toError(name string, list field.ErrorList) error {
	if len(list) == 0 {
		return nil
	}
	return apierrors.NewInvalid(
		provisioning.ConnectionResourceInfo.GroupVersionKind().GroupKind(),
		name,
		list,
	)
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
