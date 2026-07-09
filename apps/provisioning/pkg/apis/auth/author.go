package auth

import (
	"context"

	authlib "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

// GetAuthorFromRequester returns a commit signature for the user in ctx, or
// false when the request is not made by a user.
func GetAuthorFromRequester(ctx context.Context) (repository.CommitSignature, bool) {
	id, err := identity.GetRequester(ctx)
	if err != nil || !id.IsIdentityType(authlib.TypeUser) {
		return repository.CommitSignature{}, false
	}
	return repository.CommitSignature{Name: id.GetName(), Email: id.GetEmail()}, true
}
