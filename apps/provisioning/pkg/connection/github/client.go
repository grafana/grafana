package github

import (
	"context"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

// API errors that we need to convey after parsing real GH errors (or faking them).
var (
	//lint:ignore ST1005 this is not punctuation
	ErrServiceUnavailable = apierrors.NewServiceUnavailable("github is unavailable")
)

//go:generate mockery --name Client --structname MockClient --inpackage --filename mock_client.go --with-expecter
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
