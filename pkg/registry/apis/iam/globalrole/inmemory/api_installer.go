package inmemory

import (
	"context"

	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/apiserver/pkg/server"

	"github.com/grafana/authlib/types"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/iam"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
)

var (
	_ iam.GlobalRoleApiInstaller = (*InMemoryGlobalRoleApiInstaller)(nil)

	readVerbs = map[string]bool{utils.VerbGet: true, utils.VerbList: true}
)

type InMemoryGlobalRoleApiInstaller struct {
	acService accesscontrol.Service
}

func ProvideInMemoryGlobalRoleApiInstaller(
	acService accesscontrol.Service,
) iam.GlobalRoleApiInstaller {
	return &InMemoryGlobalRoleApiInstaller{
		acService: acService,
	}
}

// GetAuthorizer denies by default and only allows reads from access-policy
// identities (internal services such as the MT reconciler). Regular users are
// denied — this API is not intended for user-facing consumption.
func (r *InMemoryGlobalRoleApiInstaller) GetAuthorizer() authorizer.Authorizer {
	return authorizer.AuthorizerFunc(func(ctx context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
		authInfo, ok := types.AuthInfoFrom(ctx)
		if !ok {
			return authorizer.DecisionDeny, "Unauthenticated", nil
		}

		if readVerbs[attr.GetVerb()] && types.IsIdentityType(authInfo.GetIdentityType(), types.TypeAccessPolicy) {
			return authorizer.DecisionAllow, "", nil
		}

		return authorizer.DecisionDeny, "Access restricted to internal services for read operations", nil
	})
}

func (r *InMemoryGlobalRoleApiInstaller) RegisterStorage(
	apiGroupInfo *server.APIGroupInfo,
	opts *builder.APIGroupOptions,
	storage map[string]rest.Storage,
) error {
	storage[iamv0.GlobalRoleInfo.StoragePath()] = NewReadOnlyGlobalRoleREST(r.acService)
	return nil
}

func (r *InMemoryGlobalRoleApiInstaller) ValidateOnCreate(_ context.Context, _ *iamv0.GlobalRole) error {
	return errReadOnly
}

func (r *InMemoryGlobalRoleApiInstaller) ValidateOnUpdate(_ context.Context, _, _ *iamv0.GlobalRole) error {
	return errReadOnly
}

func (r *InMemoryGlobalRoleApiInstaller) ValidateOnDelete(_ context.Context, _ *iamv0.GlobalRole) error {
	return errReadOnly
}

func (r *InMemoryGlobalRoleApiInstaller) MutateOnCreate(_ context.Context, _ *iamv0.GlobalRole) error {
	return errReadOnly
}

func (r *InMemoryGlobalRoleApiInstaller) MutateOnUpdate(_ context.Context, _, _ *iamv0.GlobalRole) error {
	return errReadOnly
}

func (r *InMemoryGlobalRoleApiInstaller) MutateOnDelete(_ context.Context, _ *iamv0.GlobalRole) error {
	return errReadOnly
}

func (r *InMemoryGlobalRoleApiInstaller) MutateOnConnect(_ context.Context, _ *iamv0.GlobalRole) error {
	return nil
}
