package secret

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/authorization/authorizer"
)

func TestSecretAuthorizer(t *testing.T) {
	t.Run("when the request is not for a resource, the decision is 'no opinion'", func(t *testing.T) {
		ctx := context.Background()

		sa := SecretAuthorizer(nil)

		attr := &fakeAttributes{isResource: false}

		decision, reason, err := sa.Authorize(ctx, attr)
		require.Equal(t, authorizer.DecisionNoOpinion, decision)
		require.Empty(t, reason)
		require.NoError(t, err)
	})

	t.Run("when the request verb is not Create or List and the name is empty, the decision is 'deny'", func(t *testing.T) {
		ctx := context.Background()

		sa := SecretAuthorizer(nil)

		attr := &fakeAttributes{isResource: true, verb: utils.VerbUpdate}

		decision, reason, err := sa.Authorize(ctx, attr)
		require.Equal(t, authorizer.DecisionDeny, decision)
		require.NotEmpty(t, reason)
		require.NoError(t, err)
	})

	t.Run("when the request does not have a namespace, the decision is 'deny'", func(t *testing.T) {
		ctx := context.Background()

		sa := SecretAuthorizer(nil)

		attr := &fakeAttributes{isResource: true, verb: utils.VerbCreate}

		decision, reason, err := sa.Authorize(ctx, attr)
		require.Equal(t, authorizer.DecisionDeny, decision)
		require.NotEmpty(t, reason)
		require.NoError(t, err)
	})

	t.Run("when the request does not have a valid user requester in the context, the decision is 'deny'", func(t *testing.T) {
		ctx := context.Background()

		sa := SecretAuthorizer(nil)

		attr := &fakeAttributes{isResource: true, verb: utils.VerbCreate, namespace: "default"}

		decision, reason, err := sa.Authorize(ctx, attr)
		require.Equal(t, authorizer.DecisionDeny, decision)
		require.NotEmpty(t, reason)
		require.Error(t, err)
	})

	t.Run("when creating a resource", func(t *testing.T) {
		t.Run("if the user has the required permissions, the decision is 'allow'", func(t *testing.T) {
			var orgID int64 = 1

			requester := &identity.StaticRequester{
				Type:  "user",
				OrgID: orgID,
				Permissions: map[int64]map[string][]string{
					orgID: {
						ActionSecretsManagerWrite: {ScopeAll},
					},
				},
			}

			ctx := identity.WithRequester(context.Background(), requester)

			sa := SecretAuthorizer(acimpl.ProvideAccessControl(featuremgmt.WithFeatures()))

			attr := &fakeAttributes{
				isResource: true,
				verb:       utils.VerbCreate,
				namespace:  "default", // -> org 1
			}

			decision, reason, err := sa.Authorize(ctx, attr)
			require.Equal(t, authorizer.DecisionAllow, decision)
			require.Empty(t, reason)
			require.NoError(t, err)

			t.Run("[TODO confirm] but if the request is for another namespace, the decision is 'deny'", func(t *testing.T) {
				attr := &fakeAttributes{
					isResource: true,
					verb:       utils.VerbCreate,
					namespace:  "org-2",
				}

				decision, reason, err := sa.Authorize(ctx, attr)
				require.Equal(t, authorizer.DecisionDeny, decision)
				require.NotEmpty(t, reason)
				require.NoError(t, err)
			})
		})

		t.Run("if the user does not have the required permissions, the decision is 'deny'", func(t *testing.T) {
			var orgID int64 = 1

			requester := &identity.StaticRequester{
				Type:        "user",
				OrgID:       orgID,
				Permissions: map[int64]map[string][]string{},
			}

			ctx := identity.WithRequester(context.Background(), requester)

			sa := SecretAuthorizer(acimpl.ProvideAccessControl(featuremgmt.WithFeatures()))

			attr := &fakeAttributes{
				isResource: true,
				verb:       utils.VerbCreate,
				namespace:  "default", // -> org 1
			}

			decision, reason, err := sa.Authorize(ctx, attr)
			require.Equal(t, authorizer.DecisionDeny, decision)
			require.NotEmpty(t, reason)
			require.NoError(t, err)
		})
	})
}

type fakeAttributes struct {
	authorizer.Attributes
	verb       string
	name       string
	namespace  string
	isResource bool
}

func (a *fakeAttributes) GetVerb() string {
	return a.verb
}

func (a *fakeAttributes) IsResourceRequest() bool {
	return a.isResource
}

func (a *fakeAttributes) GetName() string {
	return a.name
}

func (a *fakeAttributes) GetNamespace() string {
	return a.namespace
}
