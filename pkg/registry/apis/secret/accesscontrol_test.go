package secret

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
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

	for _, verb := range []string{utils.VerbGet, utils.VerbUpdate, utils.VerbDelete} {
		t.Run("when the request verb is "+verb+" but the name is empty, the decision is 'deny'", func(t *testing.T) {
			ctx := context.Background()

			sa := SecretAuthorizer(nil)

			attr := &fakeAttributes{isResource: true, verb: verb, namespace: t.Name()}

			decision, reason, err := sa.Authorize(ctx, attr)
			require.Equal(t, authorizer.DecisionDeny, decision)
			require.NotEmpty(t, reason)
			require.NoError(t, err)
		})
	}

	t.Run("when the request does not have a namespace, the decision is 'deny'", func(t *testing.T) {
		ctx := context.Background()

		sa := SecretAuthorizer(nil)

		attr := &fakeAttributes{isResource: true, verb: utils.VerbCreate}

		decision, reason, err := sa.Authorize(ctx, attr)
		require.Equal(t, authorizer.DecisionDeny, decision)
		require.NotEmpty(t, reason)
		require.NoError(t, err)
	})

	t.Run("when the namespace is org-based but does not have a numeric identifier, the decision is 'deny'", func(t *testing.T) {
		ctx := context.Background()

		sa := SecretAuthorizer(nil)

		attr := &fakeAttributes{isResource: true, verb: utils.VerbCreate, namespace: "org-abc"}

		decision, reason, err := sa.Authorize(ctx, attr)
		require.Equal(t, authorizer.DecisionDeny, decision)
		require.NotEmpty(t, reason)
		require.Error(t, err)
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

	t.Run("when the resource requested is not known, the decision is 'deny'", func(t *testing.T) {
		requester := &identity.StaticRequester{
			Type:  "user",
			OrgID: 1,
		}

		ctx := identity.WithRequester(context.Background(), requester)

		sa := SecretAuthorizer(nil)

		attr := &fakeAttributes{isResource: true, verb: utils.VerbCreate, namespace: "default", resource: "random"}

		decision, reason, err := sa.Authorize(ctx, attr)
		require.Equal(t, authorizer.DecisionDeny, decision)
		require.NotEmpty(t, reason)
		require.NoError(t, err)
	})
}

func TestSecretAuthorizerVerbs(t *testing.T) {
	testcases := []struct {
		verb         string
		resourceName string
		permissions  map[string][]string
	}{
		{
			verb: utils.VerbCreate,
			permissions: map[string][]string{
				ActionSecretsManagerSecureValuesWrite: {ScopeAllSecureValues},
				ActionSecretsManagerKeepersWrite:      {ScopeAllKeepers},
			},
		},
		{
			verb:         utils.VerbUpdate,
			resourceName: "resource-name",
			permissions: map[string][]string{
				ActionSecretsManagerSecureValuesWrite: {ScopeAllSecureValues},
				ActionSecretsManagerKeepersWrite:      {ScopeAllKeepers},
			},
		},
		{
			verb:         utils.VerbGet,
			resourceName: "resource-name",
			permissions: map[string][]string{
				ActionSecretsManagerSecureValuesRead: {ScopeAllSecureValues},
				ActionSecretsManagerKeepersRead:      {ScopeAllKeepers},
			},
		},
		{
			verb: utils.VerbList,
			permissions: map[string][]string{
				ActionSecretsManagerSecureValuesRead: {ScopeAllSecureValues},
				ActionSecretsManagerKeepersRead:      {ScopeAllKeepers},
			},
		},
		{
			verb:         utils.VerbDelete,
			resourceName: "resource-name",
			permissions: map[string][]string{
				ActionSecretsManagerSecureValuesDelete: {ScopeAllSecureValues},
				ActionSecretsManagerKeepersDelete:      {ScopeAllKeepers},
			},
		},
	}

	for _, resource := range []string{secretv0alpha1.SecureValuesResourceInfo.GetName(), secretv0alpha1.KeeperResourceInfo.GetName()} {
		for _, tc := range testcases {
			t.Run("when "+tc.verb+"-ing a "+resource, func(t *testing.T) {
				var orgID int64 = 1

				sa := SecretAuthorizer(acimpl.ProvideAccessControl(featuremgmt.WithFeatures()))

				attr := &fakeAttributes{
					isResource: true,
					verb:       tc.verb,
					namespace:  "default", // -> org 1
					name:       tc.resourceName,
					resource:   resource,
				}

				t.Run("if the user has the required permissions, the decision is 'allow'", func(t *testing.T) {
					requester := &identity.StaticRequester{
						Type:  "user",
						OrgID: orgID,
						Permissions: map[int64]map[string][]string{
							orgID: tc.permissions,
						},
					}

					ctx := identity.WithRequester(context.Background(), requester)

					decision, reason, err := sa.Authorize(ctx, attr)
					require.Equal(t, authorizer.DecisionAllow, decision)
					require.Empty(t, reason)
					require.NoError(t, err)

					t.Run("[TODO confirm] but if the request is for another namespace, the decision is 'deny'", func(t *testing.T) {
						attr := &fakeAttributes{
							isResource: true,
							verb:       utils.VerbCreate,
							namespace:  "org-2",
							resource:   resource,
						}

						decision, reason, err := sa.Authorize(ctx, attr)
						require.Equal(t, authorizer.DecisionDeny, decision)
						require.NotEmpty(t, reason)
						require.NoError(t, err)
					})
				})

				t.Run("if the user does not have the required permissions, the decision is 'deny'", func(t *testing.T) {
					requester := &identity.StaticRequester{
						Type:        "user",
						OrgID:       orgID,
						Permissions: map[int64]map[string][]string{},
					}

					ctx := identity.WithRequester(context.Background(), requester)

					decision, reason, err := sa.Authorize(ctx, attr)
					require.Equal(t, authorizer.DecisionDeny, decision)
					require.NotEmpty(t, reason)
					require.NoError(t, err)
				})
			})
		}

		t.Run("when getting a subresource, the decision is 'deny'", func(t *testing.T) {
			attr := &fakeAttributes{
				isResource:  true,
				verb:        utils.VerbGet,
				namespace:   "default", // -> org 1
				name:        "name",
				subresource: "subresource",
				resource:    resource,
			}

			requester := &identity.StaticRequester{
				Type:  "user",
				OrgID: 1,
			}

			ctx := identity.WithRequester(context.Background(), requester)

			sa := SecretAuthorizer(acimpl.ProvideAccessControl(featuremgmt.WithFeatures()))

			decision, reason, err := sa.Authorize(ctx, attr)
			require.Equal(t, authorizer.DecisionDeny, decision)
			require.NotEmpty(t, reason)
			require.NoError(t, err)
		})

		nonSupportedVerbs := []string{utils.VerbDeleteCollection, utils.VerbGetPermissions, utils.VerbPatch, utils.VerbSetPermissions, utils.VerbWatch}
		for _, verb := range nonSupportedVerbs {
			t.Run("for a non-supported verb "+verb+", the decision is 'deny'", func(t *testing.T) {
				attr := &fakeAttributes{
					isResource: true,
					verb:       verb,
					namespace:  "default", // -> org 1
					name:       "name",
					resource:   resource,
				}

				requester := &identity.StaticRequester{
					Type:  "user",
					OrgID: 1,
				}

				ctx := identity.WithRequester(context.Background(), requester)

				sa := SecretAuthorizer(acimpl.ProvideAccessControl(featuremgmt.WithFeatures()))

				decision, reason, err := sa.Authorize(ctx, attr)
				require.Equal(t, authorizer.DecisionDeny, decision)
				require.NotEmpty(t, reason)
				require.NoError(t, err)
			})
		}
	}
}

type fakeAttributes struct {
	authorizer.Attributes
	verb        string
	name        string
	namespace   string
	resource    string
	subresource string
	isResource  bool
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

func (a *fakeAttributes) GetResource() string {
	return a.resource
}

func (a *fakeAttributes) GetSubresource() string {
	return a.subresource
}
