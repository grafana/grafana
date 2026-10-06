package githuboauth

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	"golang.org/x/oauth2"
	oauth2github "golang.org/x/oauth2/github"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/validation/field"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection/oauth"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository/github"
)

// provider implements the GitHub-specific parts of an OAuth app connection.
type provider struct {
	client github.Client
}

func (p *provider) Endpoint() oauth2.Endpoint {
	return oauth2github.Endpoint
}

func (p *provider) Test(ctx context.Context) (*provisioning.TestResults, error) {
	// TODO: use a lighter endpoint than listing repositories to check the token.
	if _, err := p.ListRepositories(ctx); err != nil {
		if errors.Is(err, connection.ErrAuthentication) {
			return connection.FailedTestResults(
				http.StatusUnauthorized,
				[]provisioning.ErrorDetails{{
					Type:   metav1.CauseTypeFieldValueInvalid,
					Field:  field.NewPath("secure", "token").String(),
					Detail: "The provider rejected the connection's access token",
				}},
			), nil
		}
		return connection.FailedTestResults(
			http.StatusUnprocessableEntity,
			[]provisioning.ErrorDetails{{
				Type:   metav1.CauseTypeInternal,
				Detail: fmt.Errorf("failed to list repositories: %w", err).Error(),
			}},
		), nil
	}
	return connection.SuccessTestResults(), nil
}

func (p *provider) ListRepositories(ctx context.Context) ([]provisioning.ExternalRepository, error) {
	repos, err := p.client.ListRepositories(ctx)
	if err != nil {
		if errors.Is(err, repository.ErrUnauthorized) || errors.Is(err, repository.ErrPermissionDenied) {
			return nil, connection.ErrAuthentication
		}
		return nil, err
	}
	return repos, nil
}

var (
	_ oauth.Provider              = (*provider)(nil)
	_ connection.RepositoryLister = (*provider)(nil)
)
