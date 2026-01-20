package connection

import (
	"context"
	"errors"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

var (
	ErrNotImplemented = errors.New("not implemented")
)

//go:generate mockery --name Connection --structname MockConnection --inpackage --filename connection_mock.go --with-expecter
type Connection interface {
	// GenerateRepositoryToken generates a repository-scoped access token.
	// The repo parameter specifies the repository name the token should be scoped to.
	GenerateRepositoryToken(ctx context.Context, repo *provisioning.Repository) (common.RawSecureValue, error)

	// Test checks if the connection information actually works.
	Test(ctx context.Context) (*provisioning.TestResults, error)
}
