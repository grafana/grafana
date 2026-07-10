package jobs

import (
	"context"

	authlib "github.com/grafana/authlib/types"
	"github.com/open-feature/go-sdk/openfeature"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

// Author identifies the user behind a request.
type Author struct {
	Name  string
	Email string
	ID    string
}

// UserAttribution returns the author for the user in ctx, or false when user
// attribution is disabled or the request is not made by a user.
func UserAttribution(ctx context.Context) (Author, bool) {
	if !openfeature.NewDefaultClient().Boolean(ctx, featuremgmt.FlagProvisioningUserAttribution, false, openfeature.TransactionContext(ctx)) {
		return Author{}, false
	}
	id, err := identity.GetRequester(ctx)
	if err != nil || !id.IsIdentityType(authlib.TypeUser) {
		return Author{}, false
	}
	return Author{Name: id.GetName(), Email: id.GetEmail(), ID: id.GetUID()}, true
}
