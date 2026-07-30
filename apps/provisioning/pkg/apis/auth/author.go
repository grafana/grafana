package auth

import (
	"context"

	authlib "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

// GetUserSignature returns the commit signature for the user in ctx. It
// returns false when there is no requester or the request is not made by a
// user (for example a background service identity), in which case the caller
// should not attribute anything to a user.
func GetUserSignature(ctx context.Context) (repository.CommitSignature, bool) {
	id, err := identity.GetRequester(ctx)
	if err != nil || !id.IsIdentityType(authlib.TypeUser) {
		return repository.CommitSignature{}, false
	}
	return repository.CommitSignature{Name: id.GetName(), Email: id.GetEmail()}, true
}
