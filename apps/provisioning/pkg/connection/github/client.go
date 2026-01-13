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

	// Repositories
	ListInstallationRepositories(ctx context.Context, installationID string) ([]Repository, error)
}

// Repository represents a GitHub repository accessible through an installation.
type Repository struct {
	// Name of the repository
	Name string
	// Owner is the user or organization that owns the repository
	Owner string
	// URL of the repository (HTML URL)
	URL string
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

	// TODO(ferruvich): do we need any other info?
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

	// TODO(ferruvich): do we need any other info?
	return AppInstallation{
		ID:      installation.GetID(),
		Enabled: installation.GetSuspendedAt().IsZero(),
	}, nil
}

const (
	maxRepositories = 1000 // Maximum number of repositories to fetch
)

// ListInstallationRepositories lists all repositories accessible by the specified GitHub App installation.
// It first creates an installation access token using the JWT, then uses that token to list repositories.
func (r *githubClient) ListInstallationRepositories(ctx context.Context, installationID string) ([]Repository, error) {
	id, err := strconv.ParseInt(installationID, 10, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid installation ID: %s", installationID)
	}

	// Create an installation access token
	installationToken, _, err := r.gh.Apps.CreateInstallationToken(ctx, id, nil)
	if err != nil {
		var ghErr *github.ErrorResponse
		if errors.As(err, &ghErr) && ghErr.Response.StatusCode == http.StatusServiceUnavailable {
			return nil, ErrServiceUnavailable
		}
		return nil, fmt.Errorf("create installation token: %w", err)
	}

	// Create a new client with the installation token
	tokenClient := github.NewClient(nil).WithAuthToken(installationToken.GetToken())

	var allRepos []Repository
	opts := &github.ListOptions{
		Page:    1,
		PerPage: 100,
	}

	for {
		result, resp, err := tokenClient.Apps.ListRepos(ctx, opts)
		if err != nil {
			var ghErr *github.ErrorResponse
			if errors.As(err, &ghErr) && ghErr.Response.StatusCode == http.StatusServiceUnavailable {
				return nil, ErrServiceUnavailable
			}
			return nil, fmt.Errorf("list repositories: %w", err)
		}

		for _, repo := range result.Repositories {
			allRepos = append(allRepos, Repository{
				Name:  repo.GetName(),
				Owner: repo.GetOwner().GetLogin(),
				URL:   repo.GetHTMLURL(),
			})
		}

		// Check if we've exceeded the maximum allowed repositories
		if len(allRepos) > maxRepositories {
			return nil, fmt.Errorf("too many repositories to fetch (more than %d)", maxRepositories)
		}

		// If there are no more pages, break
		if resp.NextPage == 0 {
			break
		}

		opts.Page = resp.NextPage
	}

	return allRepos, nil
}
