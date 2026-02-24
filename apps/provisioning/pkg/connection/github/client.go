package github

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/google/go-github/v82/github"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

// API errors that we need to convey after parsing real GH errors (or faking them).
var (
	//lint:ignore ST1005 this is not punctuation
	ErrAuthentication = apierrors.NewUnauthorized("authentication failed")
	//lint:ignore ST1005 this is not punctuation
	ErrServiceUnavailable = apierrors.NewServiceUnavailable("github is unavailable")

	ErrNotFound            = errors.New("not found")
	ErrUnprocessableEntity = errors.New("unprocessable entity")
)

//go:generate mockery --name Client --structname MockClient --inpackage --filename client_mock.go --with-expecter
type Client interface {
	GetApp(ctx context.Context) (App, error)
	GetAppInstallation(ctx context.Context, installationID string) (AppInstallation, error)
	ListInstallationRepositories(ctx context.Context) ([]Repository, error)
	CreateInstallationAccessToken(ctx context.Context, installationID string, repo string) (InstallationToken, error)
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
	// Permissions granted to the GitHub App
	Permissions Permissions
}
type Permission int

const (
	PermissionNone Permission = iota
	PermissionRead
	PermissionWrite
)

// Permissions represents the permissions granted to a GitHub Apps and their installations.
type Permissions struct {
	Contents     Permission
	Metadata     Permission
	PullRequests Permission
	Webhooks     Permission
}

// AppInstallation represents a Github App Installation.
type AppInstallation struct {
	// ID represents the GH installation ID.
	ID int64
	// Whether the installation is enabled or not.
	Enabled bool
	// Permissions granted to this installation.
	// These may differ from App permissions if the installation owner has not yet accepted
	// the App's updated permissions on GitHub.
	Permissions Permissions
}

// InstallationToken represents a Github App Installation Access Token.
type InstallationToken struct {
	// Token is the access token value.
	Token string
	// ExpiresAt is the expiration time of the token.
	ExpiresAt time.Time
}

type githubClient struct {
	gh *github.Client
}

func NewClient(client *github.Client) Client {
	return &githubClient{gh: client}
}

// GetApp gets the app by using the given token.
func (r *githubClient) GetApp(ctx context.Context) (App, error) {
	app, _, err := r.gh.Apps.Get(ctx, "")
	if err != nil {
		var ghErr *github.ErrorResponse
		if errors.As(err, &ghErr) && ghErr.Response != nil {
			switch ghErr.Response.StatusCode {
			case http.StatusUnauthorized, http.StatusForbidden:
				return App{}, ErrAuthentication
			case http.StatusNotFound:
				return App{}, fmt.Errorf("app: %w", ErrNotFound)
			case http.StatusServiceUnavailable:
				return App{}, ErrServiceUnavailable
			}
		}
		return App{}, err
	}

	return App{
		ID:    app.GetID(),
		Slug:  app.GetSlug(),
		Owner: app.GetOwner().GetLogin(),
		Permissions: Permissions{
			Contents:     toPermission(app.GetPermissions().GetContents()),
			Metadata:     toPermission(app.GetPermissions().GetMetadata()),
			PullRequests: toPermission(app.GetPermissions().GetPullRequests()),
			Webhooks:     toPermission(app.GetPermissions().GetRepositoryHooks()),
		},
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
		if errors.As(err, &ghErr) && ghErr.Response != nil {
			switch ghErr.Response.StatusCode {
			case http.StatusUnauthorized, http.StatusForbidden:
				return AppInstallation{}, ErrAuthentication
			case http.StatusNotFound:
				return AppInstallation{}, fmt.Errorf("installation: %w", ErrNotFound)
			case http.StatusServiceUnavailable:
				return AppInstallation{}, ErrServiceUnavailable
			}
		}
		return AppInstallation{}, err
	}

	return AppInstallation{
		ID:      installation.GetID(),
		Enabled: installation.GetSuspendedAt().IsZero(),
		Permissions: Permissions{
			Contents:     toPermission(installation.GetPermissions().GetContents()),
			Metadata:     toPermission(installation.GetPermissions().GetMetadata()),
			PullRequests: toPermission(installation.GetPermissions().GetPullRequests()),
			Webhooks:     toPermission(installation.GetPermissions().GetRepositoryHooks()),
		},
	}, nil
}

func toPermission(permissions string) Permission {
	switch permissions {
	case "read":
		return PermissionRead
	case "write":
		return PermissionWrite
	default:
		return PermissionNone
	}
}

const (
	maxRepositories = 1000 // Maximum number of repositories to fetch
)

// ListInstallationRepositories lists all repositories accessible by the specified GitHub App installation.
func (r *githubClient) ListInstallationRepositories(ctx context.Context) ([]Repository, error) {
	var allRepos []Repository
	opts := &github.ListOptions{
		Page:    1,
		PerPage: 100,
	}

	for {
		result, resp, err := r.gh.Apps.ListRepos(ctx, opts)
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

// CreateInstallationAccessToken creates an installation access token scoped to a specific repository.
// Based on https://docs.github.com/en/rest/apps/apps?apiVersion=latest#create-an-installation-access-token-for-an-app
// the installation access token will last one hour from the time it is created.
func (r *githubClient) CreateInstallationAccessToken(ctx context.Context, installationID string, repo string) (InstallationToken, error) {
	id, err := strconv.Atoi(installationID)
	if err != nil {
		return InstallationToken{}, fmt.Errorf("invalid installation ID: %s", installationID)
	}

	var opts *github.InstallationTokenOptions
	if repo != "" {
		opts = &github.InstallationTokenOptions{
			Repositories: []string{repo},
		}
	}

	token, _, err := r.gh.Apps.CreateInstallationToken(ctx, int64(id), opts)
	if err != nil {
		var ghErr *github.ErrorResponse
		if errors.As(err, &ghErr) {
			switch ghErr.Response.StatusCode {
			case http.StatusServiceUnavailable:
				return InstallationToken{}, ErrServiceUnavailable
			case http.StatusUnauthorized, http.StatusForbidden:
				return InstallationToken{}, ErrAuthentication
			case http.StatusNotFound:
				// Not Found is returned by this API when the given installation is not present.
				return InstallationToken{}, fmt.Errorf("installation: %w", ErrNotFound)
			case http.StatusUnprocessableEntity:
				return InstallationToken{}, fmt.Errorf("%s: %w", ghErr.Message, ErrUnprocessableEntity)
			}
		}

		return InstallationToken{}, err
	}

	return InstallationToken{
		Token:     token.GetToken(),
		ExpiresAt: token.GetExpiresAt().Time,
	}, nil
}
