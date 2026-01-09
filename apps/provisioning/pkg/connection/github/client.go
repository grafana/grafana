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
	GetApp(ctx context.Context, token string) (App, error)
	GetAppInstallation(ctx context.Context, appToken string, installationID string) (AppInstallation, error)
}

// App represents a Github App.
type App struct {
	// ID represents the GH app ID.
	ID int64
	// Slug represents the GH app slug.
	Slug string
}

// AppInstallation represents a Github App Installation.
type AppInstallation struct {
	ID int64
}

type githubClient struct {
	gh *github.Client
}

func NewClient(client *github.Client) Client {
	return &githubClient{client}
}

// GetApp gets the app by using the given token.
func (r *githubClient) GetApp(ctx context.Context, token string) (App, error) {
	app, _, err := r.gh.WithAuthToken(token).Apps.Get(ctx, "")
	if err != nil {
		var ghErr *github.ErrorResponse
		if errors.As(err, &ghErr) && ghErr.Response.StatusCode == http.StatusServiceUnavailable {
			return App{}, ErrServiceUnavailable
		}
		return App{}, err
	}

	// TODO(ferruvich): do we need any other info?
	return App{
		ID:   app.GetID(),
		Slug: app.GetSlug(),
	}, nil
}

// GetAppInstallation gets the installation of the app related to the given token.
func (r *githubClient) GetAppInstallation(ctx context.Context, appToken string, installationID string) (AppInstallation, error) {
	id, err := strconv.Atoi(installationID)
	if err != nil {
		return AppInstallation{}, fmt.Errorf("invalid installation ID: %s", installationID)
	}

	installation, _, err := r.gh.WithAuthToken(appToken).Apps.GetInstallation(ctx, int64(id))
	if err != nil {
		var ghErr *github.ErrorResponse
		if errors.As(err, &ghErr) && ghErr.Response.StatusCode == http.StatusServiceUnavailable {
			return AppInstallation{}, ErrServiceUnavailable
		}
		return AppInstallation{}, err
	}

	// TODO(ferruvich): do we need any other info?
	return AppInstallation{
		ID: installation.GetID(),
	}, nil
}
