package github

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"

	"github.com/google/go-github/v70/github"
)

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
