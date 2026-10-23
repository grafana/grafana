package oauthsuite

import (
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/types"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func Run(t *testing.T, newHelper func(t *testing.T) *common.ProvisioningTestHelper, p Provider) {
	cases := []struct {
		name string
		run  func(t *testing.T, helper *common.ProvisioningTestHelper, p Provider)
	}{
		{"Authorize", testAuthorize},
		{"AuthorizeRejectsInvalidCode", testAuthorizeRejectsInvalidCode},
		{"Validation", testValidation},
		{"TokenDropOnProviderFieldChange", testTokenDropOnProviderFieldChange},
		{"Repositories", testRepositories},
		{"TokenRefresh", testTokenRefresh},
		{"RepositoryUsesConnectionToken", testRepositoryUsesConnectionToken},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			c.run(t, newHelper(t), p)
		})
	}
}

func testAuthorize(t *testing.T, helper *common.ProvisioningTestHelper, p Provider) {
	name := p.Name + "-oauth-authorize"
	CreateConnection(t, helper, p, name)

	conn := Authorize(t, helper, name, p.AuthorizationCode(t, name))
	assert.Positive(t, conn.Status.Token.Expiration, "token expiration should be set")
	helper.WaitForHealthyConnection(t, name)
}

func testAuthorizeRejectsInvalidCode(t *testing.T, helper *common.ProvisioningTestHelper, p Provider) {
	name := p.Name + "-oauth-invalid-code"
	CreateConnection(t, helper, p, name)

	statusCode, err := PostAuthorize(t, helper.AdminREST, name, "not-a-valid-code")
	require.Error(t, err, "the provider must reject an unknown authorization code")
	require.Equal(t, http.StatusBadRequest, statusCode)
	require.True(t, GetConnection(t, helper, name).Secure.Token.IsZero(), "a rejected code must not store a token")
}

func testValidation(t *testing.T, helper *common.ProvisioningTestHelper, p Provider) {
	if len(p.InvalidSpecs) == 0 {
		t.Skipf("%s has no provider-specific connection spec", p.Name)
	}

	for _, tt := range p.InvalidSpecs {
		t.Run(tt.Name, func(t *testing.T) {
			connection := p.NewConnection(t, p.Name+"-oauth-validation-"+tt.Name)
			tt.Mutate(connection.Object["spec"].(map[string]any))
			_, err := helper.Connections.Resource.Create(t.Context(), connection, metav1.CreateOptions{FieldValidation: "Strict"})
			require.ErrorContains(t, err, tt.Err)
		})
	}
}

func testTokenDropOnProviderFieldChange(t *testing.T, helper *common.ProvisioningTestHelper, p Provider) {
	if len(p.TokenBoundChanges) == 0 {
		t.Skipf("%s has no provider-specific fields that the token depends on", p.Name)
	}

	for _, tt := range p.TokenBoundChanges {
		t.Run(tt.Name, func(t *testing.T) {
			name := p.Name + "-oauth-token-field-" + tt.Name
			CreateConnection(t, helper, p, name)
			Authorize(t, helper, name, p.AuthorizationCode(t, name))

			UpdateConnection(t, helper, name, func(obj *unstructured.Unstructured) {
				tt.Mutate(obj.Object["spec"].(map[string]any))
			})

			require.True(t, GetConnection(t, helper, name).Secure.Token.IsZero(), "the token must be dropped when %s changes", tt.Name)
		})
	}
}

func testRepositories(t *testing.T, helper *common.ProvisioningTestHelper, p Provider) {
	if p.Repositories == nil {
		t.Skipf("%s connections do not list repositories", p.Name)
	}

	name := p.Name + "-oauth-repositories"
	CreateConnection(t, helper, p, name)
	Authorize(t, helper, name, p.AuthorizationCode(t, name))

	var list provisioning.ExternalRepositoryList
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		result := helper.AdminREST.Get().
			Namespace("default").
			Resource("connections").
			Name(name).
			SubResource("repositories").
			Do(t.Context())
		if !assert.NoError(collect, result.Error()) {
			return
		}
		assert.NoError(collect, result.Into(&list))
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "repositories listing should succeed")

	require.ElementsMatch(t, p.Repositories, list.Items)
}

func testTokenRefresh(t *testing.T, helper *common.ProvisioningTestHelper, p Provider) {
	if p.ShortLivedAuthorizationCode == nil {
		t.Skipf("%s cannot issue short-lived tokens", p.Name)
	}

	name := p.Name + "-oauth-refresh"
	CreateConnection(t, helper, p, name)
	before := Authorize(t, helper, name, p.ShortLivedAuthorizationCode(t, name)).Status.Token

	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		patch := common.AsJSON(map[string]any{"status": map[string]any{"health": map[string]any{"checked": time.Now().UnixMilli() - 1}}})
		_, err := helper.Connections.Resource.Patch(t.Context(), name, types.MergePatchType, patch, metav1.PatchOptions{}, "status")
		require.NoError(collect, err)
		obj, err := helper.Connections.Resource.Get(t.Context(), name, metav1.GetOptions{})
		require.NoError(collect, err)
		conn, err := common.FromUnstructured[provisioning.Connection](obj)
		require.NoError(collect, err)
		assert.Greater(collect, conn.Status.Token.LastUpdated, before.LastUpdated, "token lastUpdated should advance")
		assert.Greater(collect, conn.Status.Token.Expiration, before.Expiration, "refreshed token should expire later")
	}, 45*time.Second, time.Second, "short-lived token should be refreshed")

	helper.WaitForHealthyConnection(t, name)
}

func testRepositoryUsesConnectionToken(t *testing.T, helper *common.ProvisioningTestHelper, p Provider) {
	if p.CreateRepository == nil {
		t.Skipf("%s cannot serve git for a connection", p.Name)
	}

	name := p.Name + "-oauth-repository"
	CreateConnection(t, helper, p, name)
	Authorize(t, helper, name, p.AuthorizationCode(t, name))
	helper.WaitForHealthyConnection(t, name)

	repo, dashboardUID, path := p.CreateRepository(t, helper, name)
	helper.WaitForHealthyRepository(t, repo)

	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		obj, err := helper.Repositories.Resource.Get(t.Context(), repo, metav1.GetOptions{})
		if !assert.NoError(collect, err) {
			return
		}
		r, err := common.FromUnstructured[provisioning.Repository](obj)
		if !assert.NoError(collect, err) {
			return
		}
		assert.False(collect, r.Secure.Token.IsZero(), "repository token should be generated from the connection")
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault)

	helper.SyncAndWait(t, repo, nil)
	common.RequireRepoManagedDashboard(t, helper.DashboardsV1, dashboardUID, repo, path)
}
