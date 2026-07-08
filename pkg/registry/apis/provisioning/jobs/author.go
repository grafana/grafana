package jobs

import (
	"context"

	authlib "github.com/grafana/authlib/types"
	"github.com/open-feature/go-sdk/openfeature"

	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

func UserAttribution(ctx context.Context) (repository.CommitSignature, bool) {
	if !openfeature.NewDefaultClient().Boolean(ctx, featuremgmt.FlagProvisioningUserAttribution, false, openfeature.TransactionContext(ctx)) {
		return repository.CommitSignature{}, false
	}
	id, err := identity.GetRequester(ctx)
	if err != nil || !id.IsIdentityType(authlib.TypeUser) {
		return repository.CommitSignature{}, false
	}
	return repository.CommitSignature{Name: id.GetName(), Email: id.GetEmail()}, true
}
