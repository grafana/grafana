package oauthsuite

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

const RedirectURI = "https://grafana.example.com/callback"

type Provider interface {
	Name() string
	NewConnection(t *testing.T, name string) *unstructured.Unstructured
	AuthorizationCode(t *testing.T, name string) string
}

type RepositoryLister interface {
	Repositories() []provisioning.ExternalRepository
}

type TokenRefresher interface {
	ShortLivedAuthorizationCode(t *testing.T, name string) string
}

type RepositoryCreator interface {
	CreateRepository(t *testing.T, helper *common.ProvisioningTestHelper, connection string) (repo, dashboardUID, path string)
}

func Run(t *testing.T, newHelper func(t *testing.T) *common.ProvisioningTestHelper, p Provider) {
	cases := []struct {
		name string
		run  func(t *testing.T, helper *common.ProvisioningTestHelper, p Provider)
	}{
		{"CRUDL", testCRUDL},
		{"Mutation", testMutation},
		{"Validation", testValidation},
		{"Unauthorized", testUnauthorized},
		{"Authorize", testAuthorize},
		{"TokenDropOnCredentialChange", testTokenDropOnCredentialChange},
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

func createConnection(t *testing.T, helper *common.ProvisioningTestHelper, p Provider, name string) {
	t.Helper()
	_, err := helper.Connections.Resource.Create(t.Context(), p.NewConnection(t, name), metav1.CreateOptions{FieldValidation: "Strict"})
	require.NoError(t, err, "failed to create connection")
}

func authorize(t *testing.T, helper *common.ProvisioningTestHelper, name, code string) *provisioning.Connection {
	t.Helper()
	helper.AuthorizeConnection(t, name, code, RedirectURI)
	var conn *provisioning.Connection
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		obj, err := helper.Connections.Resource.Get(t.Context(), name, metav1.GetOptions{})
		if !assert.NoError(collect, err) {
			return
		}
		conn = common.MustFromUnstructured[provisioning.Connection](t, obj)
		assert.False(collect, conn.Secure.Token.IsZero(), "secure should contain the exchanged token")
		assert.Positive(collect, conn.Status.Token.LastUpdated, "token lastUpdated should be set")
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "token should be stored after authorize")
	return conn
}

func getConnection(t *testing.T, helper *common.ProvisioningTestHelper, name string) *provisioning.Connection {
	t.Helper()
	obj, err := helper.Connections.Resource.Get(t.Context(), name, metav1.GetOptions{})
	require.NoError(t, err, "failed to get connection")
	return common.MustFromUnstructured[provisioning.Connection](t, obj)
}

func testCRUDL(t *testing.T, helper *common.ProvisioningTestHelper, p Provider) {
	name := p.Name() + "-oauth-crudl"
	expected := p.NewConnection(t, name)
	_, err := helper.Connections.Resource.Create(t.Context(), expected, metav1.CreateOptions{FieldValidation: "Strict"})
	require.NoError(t, err, "failed to create connection")

	output, err := helper.Connections.Resource.Get(t.Context(), name, metav1.GetOptions{})
	require.NoError(t, err, "failed to read back connection")
	spec := output.Object["spec"].(map[string]any)
	expectedSpec := expected.Object["spec"].(map[string]any)
	assert.Equal(t, expectedSpec["type"], spec["type"])
	assert.Equal(t, expectedSpec["oauth"], spec["oauth"])
	secure := output.Object["secure"].(map[string]any)
	assert.Contains(t, secure, "clientSecret", "secure should contain clientSecret")
	assert.NotContains(t, secure, "token", "secure should not contain a token before authorization")

	list, err := helper.Connections.Resource.List(t.Context(), metav1.ListOptions{})
	require.NoError(t, err, "failed to list connections")
	assert.Len(t, list.Items, 1, "should have one connection")

	updated := output.DeepCopy()
	updated.SetResourceVersion("")
	updated.Object["spec"].(map[string]any)["title"] = "Updated title"
	res, err := helper.Connections.Resource.Update(t.Context(), updated, metav1.UpdateOptions{FieldValidation: "Strict"})
	require.NoError(t, err, "failed to update connection")
	assert.Equal(t, "Updated title", res.Object["spec"].(map[string]any)["title"])

	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		err := helper.Connections.Resource.Delete(t.Context(), name, metav1.DeleteOptions{})
		assert.True(collect, err == nil || apierrors.IsNotFound(err), "delete should succeed: %v", err)
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "should delete connection")
}

func testMutation(t *testing.T, helper *common.ProvisioningTestHelper, p Provider) {
	connection := p.NewConnection(t, p.Name()+"-oauth-mutation")
	unstructured.RemoveNestedField(connection.Object, "metadata", "name")

	c, err := helper.Connections.Resource.Create(t.Context(), connection, metav1.CreateOptions{FieldValidation: "Strict"})
	require.NoError(t, err, "failed to create connection")
	typ, _, _ := unstructured.NestedString(connection.Object, "spec", "type")
	require.True(t, strings.HasPrefix(c.GetName(), typ+"-"), "generated name %q should have the type prefix", c.GetName())
}

func testValidation(t *testing.T, helper *common.ProvisioningTestHelper, p Provider) {
	for _, tt := range []struct {
		name   string
		mutate func(obj *unstructured.Unstructured)
		err    string
	}{
		{
			name:   "no-oauth",
			mutate: func(obj *unstructured.Unstructured) { unstructured.RemoveNestedField(obj.Object, "spec", "oauth") },
			err:    "oauth info must be specified for OAuth app connections",
		},
		{
			name:   "no-secret",
			mutate: func(obj *unstructured.Unstructured) { delete(obj.Object, "secure") },
			err:    "clientSecret must be specified for OAuth app connections",
		},
		{
			name: "private-key",
			mutate: func(obj *unstructured.Unstructured) {
				obj.Object["secure"].(map[string]any)["privateKey"] = map[string]any{"create": "some-private-key"}
			},
			err: "privateKey is forbidden in OAuth app connections",
		},
	} {
		t.Run(tt.name, func(t *testing.T) {
			connection := p.NewConnection(t, p.Name()+"-oauth-validation-"+tt.name)
			tt.mutate(connection)
			_, err := helper.Connections.Resource.Create(t.Context(), connection, metav1.CreateOptions{FieldValidation: "Strict"})
			require.ErrorContains(t, err, tt.err)
		})
	}
}

func testUnauthorized(t *testing.T, helper *common.ProvisioningTestHelper, p Provider) {
	name := p.Name() + "-oauth-unauthorized"
	createConnection(t, helper, p, name)

	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		obj, err := helper.Connections.Resource.Get(t.Context(), name, metav1.GetOptions{})
		if !assert.NoError(collect, err) {
			return
		}
		conn := common.MustFromUnstructured[provisioning.Connection](t, obj)
		assert.Equal(collect, conn.Generation, conn.Status.ObservedGeneration, "controller should have reconciled the connection")
		assert.Positive(collect, conn.Status.Health.Checked, "health check should have run")
		assert.False(collect, conn.Status.Health.Healthy, "unauthorized connection should be unhealthy")
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "connection should be reconciled")

	require.True(t, getConnection(t, helper, name).Secure.Token.IsZero(), "controller must not mint a token for oauth connections")
}

func testAuthorize(t *testing.T, helper *common.ProvisioningTestHelper, p Provider) {
	name := p.Name() + "-oauth-authorize"
	createConnection(t, helper, p, name)

	t.Run("viewer cannot authorize", func(t *testing.T) {
		body, err := json.Marshal(&provisioning.ConnectionAuthorizeRequest{
			Spec: provisioning.ConnectionAuthorizeRequestSpec{Code: "test-authorization-code"},
		})
		require.NoError(t, err)

		var statusCode int
		result := helper.ViewerREST.Post().
			Namespace("default").
			Resource("connections").
			Name(name).
			SubResource("authorize").
			Body(body).
			SetHeader("Content-Type", "application/json").
			Do(t.Context()).
			StatusCode(&statusCode)
		require.Error(t, result.Error(), "viewer should not be able to authorize")
		require.Equal(t, http.StatusForbidden, statusCode)
	})

	t.Run("authorize exchanges the code and the connection becomes healthy", func(t *testing.T) {
		conn := authorize(t, helper, name, p.AuthorizationCode(t, name))
		assert.Positive(t, conn.Status.Token.Expiration, "token expiration should be set")
		helper.WaitForHealthyConnection(t, name)
	})
}

func testTokenDropOnCredentialChange(t *testing.T, helper *common.ProvisioningTestHelper, p Provider) {
	update := func(t *testing.T, name string, mutate func(obj *unstructured.Unstructured)) {
		t.Helper()
		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			output, err := helper.Connections.Resource.Get(t.Context(), name, metav1.GetOptions{})
			if !assert.NoError(collect, err) {
				return
			}
			updated := output.DeepCopy()
			delete(updated.Object["secure"].(map[string]any), "token")
			mutate(updated)
			_, err = helper.Connections.Resource.Update(t.Context(), updated, metav1.UpdateOptions{FieldValidation: "Strict"})
			assert.NoError(collect, err)
		}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "update should succeed")
	}

	for _, tt := range []struct {
		name      string
		mutate    func(obj *unstructured.Unstructured)
		keepToken bool
	}{
		{
			name:      "kept",
			mutate:    func(obj *unstructured.Unstructured) { obj.Object["spec"].(map[string]any)["title"] = "Updated title" },
			keepToken: true,
		},
		{
			name: "drop-id",
			mutate: func(obj *unstructured.Unstructured) {
				obj.Object["spec"].(map[string]any)["oauth"].(map[string]any)["clientID"] = "another-client-id"
			},
		},
		{
			name: "drop-secret",
			mutate: func(obj *unstructured.Unstructured) {
				obj.Object["secure"].(map[string]any)["clientSecret"] = map[string]any{"create": "another-client-secret"}
			},
		},
	} {
		t.Run(tt.name, func(t *testing.T) {
			name := p.Name() + "-oauth-token-" + tt.name
			createConnection(t, helper, p, name)
			authorize(t, helper, name, p.AuthorizationCode(t, name))

			update(t, name, tt.mutate)

			assert.Equal(t, tt.keepToken, !getConnection(t, helper, name).Secure.Token.IsZero())
		})
	}
}

func testRepositories(t *testing.T, helper *common.ProvisioningTestHelper, p Provider) {
	lister, ok := p.(RepositoryLister)
	if !ok {
		t.Skipf("%s connections do not list repositories", p.Name())
	}

	name := p.Name() + "-oauth-repositories"
	createConnection(t, helper, p, name)
	authorize(t, helper, name, p.AuthorizationCode(t, name))

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

	require.ElementsMatch(t, lister.Repositories(), list.Items)
}

func testTokenRefresh(t *testing.T, helper *common.ProvisioningTestHelper, p Provider) {
	refresher, ok := p.(TokenRefresher)
	if !ok {
		t.Skipf("%s cannot issue short-lived tokens", p.Name())
	}

	name := p.Name() + "-oauth-refresh"
	createConnection(t, helper, p, name)
	before := authorize(t, helper, name, refresher.ShortLivedAuthorizationCode(t, name)).Status.Token

	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		helper.TriggerConnectionReconciliation(t, name)
		conn := getConnection(t, helper, name)
		assert.Greater(collect, conn.Status.Token.LastUpdated, before.LastUpdated, "token lastUpdated should advance")
		assert.Greater(collect, conn.Status.Token.Expiration, before.Expiration, "refreshed token should expire later")
	}, 45*time.Second, time.Second, "short-lived token should be refreshed")

	helper.WaitForHealthyConnection(t, name)
}

func testRepositoryUsesConnectionToken(t *testing.T, helper *common.ProvisioningTestHelper, p Provider) {
	creator, ok := p.(RepositoryCreator)
	if !ok {
		t.Skipf("%s cannot serve git for a connection", p.Name())
	}

	name := p.Name() + "-oauth-repository"
	createConnection(t, helper, p, name)
	authorize(t, helper, name, p.AuthorizationCode(t, name))
	helper.WaitForHealthyConnection(t, name)

	repo, dashboardUID, path := creator.CreateRepository(t, helper, name)
	helper.WaitForHealthyRepository(t, repo)

	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		obj, err := helper.Repositories.Resource.Get(t.Context(), repo, metav1.GetOptions{})
		if !assert.NoError(collect, err) {
			return
		}
		r := common.MustFromUnstructured[provisioning.Repository](t, obj)
		assert.False(collect, r.Secure.Token.IsZero(), "repository token should be generated from the connection")
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault)

	helper.SyncAndWait(t, repo, nil)
	common.RequireRepoManagedDashboard(t, helper.DashboardsV1, dashboardUID, repo, path)
}
