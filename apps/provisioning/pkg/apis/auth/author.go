package auth

import (
	"context"

	authlib "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

// Author identifies the user behind a request.
type Author struct {
	Name  string
	Email string
}

// GetAuthorFromRequester returns the Author for the user in ctx. It returns
// false when there is no requester or the request is not made by a user (for
// example a background service identity), in which case the caller should not
// attribute anything to a user.
func GetAuthorFromRequester(ctx context.Context) (Author, bool) {
	id, err := identity.GetRequester(ctx)
	if err != nil || !id.IsIdentityType(authlib.TypeUser) {
		return Author{}, false
	}
	return Author{Name: id.GetName(), Email: id.GetEmail()}, true
}
