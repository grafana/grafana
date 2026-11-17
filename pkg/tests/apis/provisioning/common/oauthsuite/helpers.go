package oauthsuite

import (
	"encoding/json"
	"fmt"
	"maps"
	"net/http"
	"strings"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/rest"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

type Provider struct {
	Name              string
	NewConnection     func(t *testing.T, name string) *unstructured.Unstructured
	AuthorizationCode func(t *testing.T, name string) string

	ShortLivedAuthorizationCode func(t *testing.T, name string) string
	CreateRepository            func(t *testing.T, helper *common.ProvisioningTestHelper, connection string) (repo, dashboardUID, path string)
	Repositories                []provisioning.ExternalRepository
	InvalidSpecs                []SpecCase
	TokenBoundChanges           []SpecCase
}

type SpecCase struct {
	Name   string
	Mutate func(spec map[string]any)
	Err    string
}

const RedirectURI = "https://grafana.example.com/callback"

func CreateConnection(t *testing.T, helper *common.ProvisioningTestHelper, p Provider, name string) {
	t.Helper()
	_, err := helper.Connections.Resource.Create(t.Context(), p.NewConnection(t, name), metav1.CreateOptions{FieldValidation: "Strict"})
	require.NoError(t, err, "failed to create connection")
}

func Authorize(t *testing.T, helper *common.ProvisioningTestHelper, name, code string) *provisioning.Connection {
	t.Helper()
	helper.AuthorizeConnection(t, name, code, RedirectURI)
	var conn *provisioning.Connection
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		obj, err := helper.Connections.Resource.Get(t.Context(), name, metav1.GetOptions{})
		if !assert.NoError(collect, err) {
			return
		}
		conn, err = common.FromUnstructured[provisioning.Connection](obj)
		if !assert.NoError(collect, err) {
			return
		}
		assert.False(collect, conn.Secure.Token.IsZero(), "secure should contain the exchanged token")
		assert.Positive(collect, conn.Status.Token.LastUpdated, "token lastUpdated should be set")
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "token should be stored after authorize")
	return conn
}

func PostAuthorize(t *testing.T, client *rest.RESTClient, name, code string) (int, error) {
	t.Helper()
	body, err := json.Marshal(&provisioning.ConnectionAuthorizeRequest{
		Spec: provisioning.ConnectionAuthorizeRequestSpec{Code: code, RedirectURI: RedirectURI},
	})
	require.NoError(t, err)

	var statusCode int
	result := client.Post().
		Namespace("default").
		Resource("connections").
		Name(name).
		SubResource("authorize").
		Body(body).
		SetHeader("Content-Type", "application/json").
		Do(t.Context()).
		StatusCode(&statusCode)
	return statusCode, result.Error()
}

func GetConnection(t *testing.T, helper *common.ProvisioningTestHelper, name string) *provisioning.Connection {
	t.Helper()
	obj, err := helper.Connections.Resource.Get(t.Context(), name, metav1.GetOptions{})
	require.NoError(t, err, "failed to get connection")
	return common.MustFromUnstructured[provisioning.Connection](t, obj)
}

func UpdateConnection(t *testing.T, helper *common.ProvisioningTestHelper, name string, mutate func(obj *unstructured.Unstructured)) {
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

const (
	MockAuthorizationCode = "test-authorization-code"
	MockShortLivedCode    = "short-lived-code"
	MockNonExpiringCode   = "non-expiring-code"
	MockClientSecret      = "test-client-secret"
)

type MockTokens struct {
	mu     sync.Mutex
	issued map[string]int
}

func NewMockTokens() *MockTokens {
	return &MockTokens{issued: map[string]int{}}
}

func (f *MockTokens) HandleToken(w http.ResponseWriter, r *http.Request) {
	clientID, secret, ok := r.BasicAuth()
	if !ok {
		clientID, secret = r.FormValue("client_id"), r.FormValue("client_secret")
	}
	if secret != MockClientSecret {
		common.WriteJSON(w, http.StatusUnauthorized, map[string]any{"error": "invalid_client"})
		return
	}

	expiresIn := 7200
	expiring := true
	switch r.FormValue("grant_type") {
	case "authorization_code":
		switch r.FormValue("code") {
		case MockShortLivedCode:
			expiresIn = 30
		case MockNonExpiringCode:
			expiring = false
		case MockAuthorizationCode:
		default:
			common.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid_grant"})
			return
		}
	case "refresh_token":
		f.mu.Lock()
		latest := fmt.Sprintf("%s-refresh-%d", clientID, f.issued[clientID])
		f.mu.Unlock()
		if r.FormValue("refresh_token") != latest {
			common.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid_grant"})
			return
		}
	default:
		common.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "unsupported_grant_type"})
		return
	}

	f.mu.Lock()
	f.issued[clientID]++
	n := f.issued[clientID]
	f.mu.Unlock()
	token := map[string]any{"access_token": fmt.Sprintf("%s-%d", clientID, n), "token_type": "bearer"}
	if expiring {
		token["refresh_token"] = fmt.Sprintf("%s-refresh-%d", clientID, n)
		token["expires_in"] = expiresIn
	}
	common.WriteJSON(w, http.StatusOK, token)
}

func (f *MockTokens) Authorized(r *http.Request) bool {
	token, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
	if !ok {
		return false
	}
	i := strings.LastIndex(token, "-")
	if i < 0 {
		return false
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	return fmt.Sprintf("%s-%d", token[:i], f.issued[token[:i]]) == token
}

func NewMockProvider(name string, connectionType provisioning.ConnectionType, spec map[string]any) Provider {
	return Provider{
		Name: name,
		NewConnection: func(_ *testing.T, connection string) *unstructured.Unstructured {
			connectionSpec := map[string]any{
				"title": connection,
				"type":  string(connectionType),
				"oauth": map[string]any{"clientID": connection + "-client"},
			}
			maps.Copy(connectionSpec, runtime.DeepCopyJSON(spec))
			return &unstructured.Unstructured{Object: map[string]any{
				"apiVersion": provisioning.APIVERSION,
				"kind":       "Connection",
				"metadata":   map[string]any{"name": connection, "namespace": "default"},
				"spec":       connectionSpec,
				"secure": map[string]any{
					"clientSecret": map[string]any{"create": MockClientSecret},
				},
			}}
		},
		AuthorizationCode:           func(*testing.T, string) string { return MockAuthorizationCode },
		ShortLivedAuthorizationCode: func(*testing.T, string) string { return MockShortLivedCode },
	}
}
