package inmemory

import (
	"context"
	"time"

	"github.com/open-feature/go-sdk/openfeature"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/apiserver/pkg/server"

	"github.com/grafana/authlib/types"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/iam"
	"github.com/grafana/grafana/pkg/registry/apis/iam/globalrole"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
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
	client := openfeature.NewDefaultClient()
	ctx, cancelFn := context.WithTimeout(context.Background(), time.Second*5)
	defer cancelFn()

	if !client.Boolean(ctx, featuremgmt.FlagKubernetesAuthzGlobalRolesApi, false, openfeature.TransactionContext(ctx)) {
		return iam.ProvideNoopGlobalRoleApiInstaller()
	}

	return &InMemoryGlobalRoleApiInstaller{
		acService: acService,
	}
}

// GetAuthorizer restricts access to access-policy identities (internal
// services such as the MT reconciler). Regular users are denied even for
// reads — this API is not intended for user-facing consumption.
func (r *InMemoryGlobalRoleApiInstaller) GetAuthorizer() authorizer.Authorizer {
	return authorizer.AuthorizerFunc(func(ctx context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
		authInfo, ok := types.AuthInfoFrom(ctx)
		if !ok {
			return authorizer.DecisionDeny, "Unauthenticated", nil
		}

		if !readVerbs[attr.GetVerb()] {
			return authorizer.DecisionDeny, "Write operations not supported", nil
		}

		if !types.IsIdentityType(authInfo.GetIdentityType(), types.TypeAccessPolicy) {
			return authorizer.DecisionDeny, "Access restricted to internal services", nil
		}

		return authorizer.DecisionAllow, "", nil
	})
}

func (r *InMemoryGlobalRoleApiInstaller) RegisterStorage(
	apiGroupInfo *server.APIGroupInfo,
	opts *builder.APIGroupOptions,
	storage map[string]rest.Storage,
) error {
	inMemoryREST := NewReadOnlyGlobalRoleREST(r.acService)
	appIdentityWrapper := &globalrole.GlobalRoleIdentityWrapper{Storage: inMemoryREST}
	storage[iamv0.GlobalRoleInfo.StoragePath()] = appIdentityWrapper
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
