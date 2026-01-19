package github

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"

	"github.com/google/go-github/v70/github"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

// API errors that we need to convey after parsing real GH errors (or faking them).
var (
	//lint:ignore ST1005 this is not punctuation
	ErrServiceUnavailable = apierrors.NewServiceUnavailable("github is unavailable")
)

//go:generate mockery --name Client --structname MockClient --inpackage --filename client_mock.go --with-expecter
type Client interface {
	// Apps and installations
	GetApp(ctx context.Context) (App, error)
	GetAppInstallation(ctx context.Context, installationID string) (AppInstallation, error)
	CreateInstallationAccessToken(ctx context.Context, installationID string, repo string) (InstallationToken, error)
}

// App represents a Github App.
type App struct {
	// ID represents the GH app ID.
	ID int64
	// Slug represents the GH app slug.
	Slug string
	// Owner represents the GH account/org owning the app
	Owner string
}

// AppInstallation represents a Github App Installation.
type AppInstallation struct {
	// ID represents the GH installation ID.
	ID int64
	// Whether the installation is enabled or not.
	Enabled bool
}

// InstallationToken represents a Github App Installation Access Token.
type InstallationToken struct {
	// Token is the access token value.
	Token string
	// ExpiresAt is the expiration time of the token.
	ExpiresAt string
}

type githubClient struct {
	gh *github.Client
}

func NewClient(client *github.Client) Client {
	return &githubClient{client}
}

// GetApp gets the app by using the given token.
func (r *githubClient) GetApp(ctx context.Context) (App, error) {
	app, _, err := r.gh.Apps.Get(ctx, "")
	if err != nil {
		var ghErr *github.ErrorResponse
		if errors.As(err, &ghErr) && ghErr.Response.StatusCode == http.StatusServiceUnavailable {
			return App{}, ErrServiceUnavailable
		}
		return App{}, err
	}

	return App{
		ID:    app.GetID(),
		Slug:  app.GetSlug(),
		Owner: app.GetOwner().GetLogin(),
	}, nil
}

// GetAppInstallation gets the installation of the app related to the given token.
func (r *githubClient) GetAppInstallation(ctx context.Context, installationID string) (AppInstallation, error) {
	id, err := strconv.Atoi(installationID)
	if err != nil {
		return AppInstallation{}, fmt.Errorf("invalid installation ID: %s", installationID)
	}

	installation, _, err := r.gh.Apps.GetInstallation(ctx, int64(id))
	if err != nil {
		var ghErr *github.ErrorResponse
		if errors.As(err, &ghErr) && ghErr.Response.StatusCode == http.StatusServiceUnavailable {
			return AppInstallation{}, ErrServiceUnavailable
		}
		return AppInstallation{}, err
	}

	return AppInstallation{
		ID:      installation.GetID(),
		Enabled: installation.GetSuspendedAt().IsZero(),
	}, nil
}

// CreateInstallationAccessToken creates an installation access token scoped to a specific repository.
func (r *githubClient) CreateInstallationAccessToken(ctx context.Context, installationID string, repo string) (InstallationToken, error) {
	id, err := strconv.Atoi(installationID)
	if err != nil {
		return InstallationToken{}, fmt.Errorf("invalid installation ID: %s", installationID)
	}

	opts := &github.InstallationTokenOptions{
		Repositories: []string{repo},
	}

	token, _, err := r.gh.Apps.CreateInstallationToken(ctx, int64(id), opts)
	if err != nil {
		var ghErr *github.ErrorResponse
		if errors.As(err, &ghErr) && ghErr.Response.StatusCode == http.StatusServiceUnavailable {
			return InstallationToken{}, ErrServiceUnavailable
		}
		return InstallationToken{}, err
	}

	return InstallationToken{
		Token:     token.GetToken(),
		ExpiresAt: token.GetExpiresAt().String(),
	}, nil
}
