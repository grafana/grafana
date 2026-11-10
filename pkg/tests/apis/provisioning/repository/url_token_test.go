package repository

import (
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/go-github/v82/github"
	ghmock "github.com/migueleliasweb/go-github-mock/src/mock"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/client-go/util/retry"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	githubconnection "github.com/grafana/grafana/apps/provisioning/pkg/connection/github"
	commonapi "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationProvisioning_GitHubAppURLChangeRemovesToken checks that a URL
// update removes the repository token whether it is omitted or sent back as a
// stored reference. Storage must consume the removal marker without copying the
// old token back, so reconciliation can obtain credentials from the connection.
// Other secure values must survive the update.
func TestIntegrationProvisioning_GitHubAppURLChangeRemovesToken(t *testing.T) {
	helper := sharedHelper(t)
	conn := &provisioning.Connection{
		TypeMeta:   metav1.TypeMeta{APIVersion: provisioning.APIVERSION, Kind: "Connection"},
		ObjectMeta: metav1.ObjectMeta{Name: "url-change-app", Namespace: "default"},
		Spec: provisioning.ConnectionSpec{
			Title: "URL change App", Type: provisioning.GithubConnectionType,
			GitHub:  &provisioning.GitHubConnectionConfig{AppID: "123456", InstallationID: "454545"},
			Webhook: &provisioning.ConnectionWebhookConfig{Disabled: true},
		},
		Secure: provisioning.ConnectionSecure{PrivateKey: commonapi.InlineSecureValue{
			Create: commonapi.RawSecureValue(base64.StdEncoding.EncodeToString([]byte(testPrivateKeyPEM))),
		}},
	}
	_, err := helper.CreateGithubConnection(t, common.MustToUnstructured(t, conn))
	require.NoError(t, err)
	repo := &provisioning.Repository{
		TypeMeta:   metav1.TypeMeta{APIVersion: provisioning.APIVERSION, Kind: "Repository"},
		ObjectMeta: metav1.ObjectMeta{Name: "url-change-repo", Namespace: "default"},
		Spec: provisioning.RepositorySpec{
			Title: "URL change repository", Type: provisioning.GitHubRepositoryType,
			GitHub:     &provisioning.GitHubRepositoryConfig{URL: "https://github.com/grafana/old", Branch: "main"},
			Connection: &provisioning.ConnectionInfo{Name: conn.Name},
			Webhook:    &provisioning.WebhookConfig{Disabled: true},
			Sync:       provisioning.SyncOptions{Target: provisioning.SyncTargetTypeFolder},
		},
		Secure: provisioning.SecureValues{
			Token:         commonapi.InlineSecureValue{Create: "old-token"},
			WebhookSecret: commonapi.InlineSecureValue{Create: "webhook-secret"},
		},
	}
	for _, includeTokenReference := range []bool{false, true} {
		name := "omitted-token"
		if includeTokenReference {
			name = "stored-token-reference"
		}
		t.Run(name, func(t *testing.T) {
			repo := repo.DeepCopy()
			repo.Name += "-" + name
			created, err := helper.Repositories.Resource.Create(t.Context(), common.MustToUnstructured(t, repo), metav1.CreateOptions{})
			require.NoError(t, err)
			stored := common.MustFromUnstructured[provisioning.Repository](t, created)
			require.NotEmpty(t, stored.Secure.Token.Name)
			require.NotEmpty(t, stored.Secure.WebhookSecret.Name)

			err = retry.RetryOnConflict(retry.DefaultRetry, func() error {
				current, err := helper.Repositories.Resource.Get(t.Context(), repo.Name, metav1.GetOptions{})
				if err != nil {
					return err
				}
				updated := common.MustFromUnstructured[provisioning.Repository](t, current)
				require.NotEmpty(t, updated.Secure.Token.Name)
				updated.Spec.GitHub.URL += "-new"
				if !includeTokenReference {
					updated.Secure.Token = commonapi.InlineSecureValue{}
				}
				result, err := helper.Repositories.Resource.Update(t.Context(), common.MustToUnstructured(t, updated), metav1.UpdateOptions{})
				if err != nil {
					return err
				}
				saved := common.MustFromUnstructured[provisioning.Repository](t, result)
				assert.Equal(t, updated.URL(), saved.URL())
				assert.True(t, saved.Secure.Token.IsZero(), "storage must consume the removal marker without restoring the token")
				assert.Equal(t, stored.Secure.WebhookSecret, saved.Secure.WebhookSecret)
				return nil
			})
			require.NoError(t, err)
		})
	}
}

// TestIntegrationProvisioning_GitHubAppURLChangeTestEndpoint checks that testing
// a changed URL uses credentials scoped to the new repository, rejects targets
// the installation cannot access, and leaves the persisted configuration intact.
func TestIntegrationProvisioning_GitHubAppURLChangeTestEndpoint(t *testing.T) {
	helper := sharedHelper(t)
	conn := helper.CreateNamedGithubConnection(t, "url-change-test-app")
	helper.WaitForHealthyConnection(t, conn.GetName())

	var tokenRequests, newRepoRequests atomic.Int64
	factory := helper.GetEnv().GithubConnectionFactory.(*githubconnection.Factory)
	originalClient := factory.Client
	t.Cleanup(func() { factory.Client = originalClient })
	factory.Client = ghmock.NewMockedHTTPClient(ghmock.WithRequestMatchHandler(
		ghmock.PostAppInstallationsAccessTokensByInstallationId,
		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var opts github.InstallationTokenOptions
			if !assert.NoError(t, json.NewDecoder(r.Body).Decode(&opts)) || !assert.Len(t, opts.Repositories, 1) {
				w.WriteHeader(http.StatusBadRequest)
				return
			}
			token := "old-token"
			switch opts.Repositories[0] {
			case "old":
			case "new":
				tokenRequests.Add(1)
				token = "new-token"
			case "inaccessible":
				tokenRequests.Add(1)
				w.WriteHeader(http.StatusUnprocessableEntity)
				_, _ = w.Write([]byte(`{"message":"repository is not accessible to the installation"}`))
				return
			default:
				t.Errorf("unexpected token scope: %v", opts.Repositories)
				w.WriteHeader(http.StatusBadRequest)
				return
			}
			w.WriteHeader(http.StatusCreated)
			_, _ = w.Write(ghmock.MustMarshal(github.InstallationToken{
				Token: new(token), ExpiresAt: &github.Timestamp{Time: time.Now().Add(time.Hour)},
			}))
		}),
	))

	gitServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		expectedToken := "old-token"
		switch {
		case strings.HasPrefix(r.URL.Path, "/grafana/old.git/"):
		case strings.HasPrefix(r.URL.Path, "/grafana/new.git/"):
			newRepoRequests.Add(1)
			expectedToken = "new-token"
		default:
			t.Errorf("unexpected Git request: %s", r.URL.Path)
			w.WriteHeader(http.StatusNotFound)
			return
		}
		_, token, ok := r.BasicAuth()
		if !assert.True(t, ok) || !assert.Equal(t, expectedToken, token) {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		switch {
		case strings.HasSuffix(r.URL.Path, "/info/refs"):
			w.Header().Set("Content-Type", "application/x-git-upload-pack-advertisement")
			_, _ = w.Write([]byte("001e# service=git-upload-pack\n0000"))
		case strings.HasSuffix(r.URL.Path, "/git-upload-pack"):
			w.Header().Set("Content-Type", "application/x-git-upload-pack-result")
			_, _ = w.Write([]byte("003d7fd1a60b01f91b314f59955a4e4d4e80d8edf11d refs/heads/main\n0000"))
		default:
			t.Errorf("unexpected Git request: %s", r.URL.Path)
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(gitServer.Close)

	repo := &provisioning.Repository{
		TypeMeta:   metav1.TypeMeta{APIVersion: provisioning.APIVERSION, Kind: "Repository"},
		ObjectMeta: metav1.ObjectMeta{Name: "url-change-test-repo", Namespace: "default"},
		Spec: provisioning.RepositorySpec{
			Title: "URL change test repository", Type: provisioning.GitHubRepositoryType,
			GitHub:     &provisioning.GitHubRepositoryConfig{URL: gitServer.URL + "/grafana/old", Branch: "main"},
			Connection: &provisioning.ConnectionInfo{Name: conn.GetName()},
			Webhook:    &provisioning.WebhookConfig{Disabled: true},
			Sync:       provisioning.SyncOptions{Target: provisioning.SyncTargetTypeFolder},
		},
	}
	_, err := helper.Repositories.Resource.Create(t.Context(), common.MustToUnstructured(t, repo), metav1.CreateOptions{})
	require.NoError(t, err)
	helper.WaitForHealthyRepository(t, repo.Name)
	obj, err := helper.Repositories.Resource.Get(t.Context(), repo.Name, metav1.GetOptions{})
	require.NoError(t, err)
	stored := common.MustFromUnstructured[provisioning.Repository](t, obj)
	require.NotEmpty(t, stored.Secure.Token.Name)

	for _, tc := range []struct {
		name       string
		repository string
		token      commonapi.InlineSecureValue
		statusCode int
	}{
		{name: "omitted token", repository: "new", statusCode: http.StatusOK},
		{name: "stored reference", repository: "new", token: stored.Secure.Token, statusCode: http.StatusOK},
		{name: "removal marker", repository: "new", token: commonapi.InlineSecureValue{Remove: true}, statusCode: http.StatusOK},
		{name: "inaccessible repository", repository: "inaccessible", statusCode: http.StatusUnprocessableEntity},
	} {
		t.Run(tc.name, func(t *testing.T) {
			updated := stored.DeepCopy()
			updated.Spec.GitHub.URL = gitServer.URL + "/grafana/" + tc.repository
			updated.Secure.Token = tc.token
			body, err := json.Marshal(updated)
			require.NoError(t, err)
			tokensBefore, requestsBefore := tokenRequests.Load(), newRepoRequests.Load()
			var statusCode int
			result := helper.AdminREST.Post().Namespace("default").Resource("repositories").
				Name(repo.Name).SubResource("test").Body(body).SetHeader("Content-Type", "application/json").
				Do(t.Context()).StatusCode(&statusCode)
			require.Equal(t, tc.statusCode, statusCode)
			assert.Equal(t, tokensBefore+1, tokenRequests.Load(), "the token must be scoped to the requested repository")
			if tc.statusCode == http.StatusOK {
				raw, err := result.Raw()
				require.NoError(t, err)
				var testResult provisioning.TestResults
				require.NoError(t, json.Unmarshal(raw, &testResult))
				assert.True(t, testResult.Success, "%+v", testResult.Errors)
				assert.Greater(t, newRepoRequests.Load(), requestsBefore)
			} else {
				require.ErrorContains(t, result.Error(), "repository is not accessible to the installation")
				assert.Equal(t, requestsBefore, newRepoRequests.Load())
			}
			obj, err := helper.Repositories.Resource.Get(t.Context(), repo.Name, metav1.GetOptions{})
			require.NoError(t, err)
			after := common.MustFromUnstructured[provisioning.Repository](t, obj)
			assert.Equal(t, stored.Spec, after.Spec)
			assert.Equal(t, stored.Secure, after.Secure)
		})
	}
}

// TestIntegrationProvisioning_ConnectionRepositoryURLChange checks that a repository
// authenticating through a connection can be repointed at another repository on the same
// host without the caller supplying a token, since the connection mints one itself. Clients
// that send only the spec (Terraform) have no way to provide one.
func TestIntegrationProvisioning_ConnectionRepositoryURLChange(t *testing.T) {
	helper := sharedHelper(t)

	const connectionName = "conn-url-change"
	const repoName = "repo-conn-url-change"

	connection := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "provisioning.grafana.app/v0alpha1",
		"kind":       "Connection",
		"metadata": map[string]any{
			"name":      connectionName,
			"namespace": "default",
		},
		"spec": map[string]any{
			"title": "URL Change Connection",
			"type":  "github",
			"github": map[string]any{
				"appID":          "123456",
				"installationID": "454545",
			},
		},
		"secure": map[string]any{
			"privateKey": map[string]any{
				"create": base64.StdEncoding.EncodeToString([]byte(testPrivateKeyPEM)),
			},
		},
	}}
	_, err := helper.CreateGithubConnection(t, connection)
	require.NoError(t, err, "failed to create connection")

	repo := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "provisioning.grafana.app/v0alpha1",
		"kind":       "Repository",
		"metadata": map[string]any{
			"name":      repoName,
			"namespace": "default",
		},
		"spec": map[string]any{
			"title": "Connection Backed Repo",
			"type":  "github",
			"sync": map[string]any{
				"enabled": false,
				"target":  "folder",
			},
			"github": map[string]any{
				"url":    "https://github.com/grafana/repo-a",
				"branch": "main",
			},
			"connection": map[string]any{
				"name": connectionName,
			},
		},
	}}
	_, err = helper.Repositories.Resource.Create(t.Context(), repo, metav1.CreateOptions{FieldValidation: "Strict"})
	require.NoError(t, err, "failed to create connection-backed repository")

	// The controller mints the token from the connection and stores it by reference, which
	// is the state a Terraform-driven update starts from.
	var mintedAt int64
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		current, err := helper.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
		require.NoError(collect, err)
		stored := common.MustFromUnstructured[provisioning.Repository](t, current)
		require.NotEmpty(collect, stored.Secure.Token.Name, "token should be minted from the connection")
		require.NotZero(collect, stored.Status.Token.LastUpdated, "token status should be stamped")
		mintedAt = stored.Status.Token.LastUpdated
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "connection token should be generated")

	t.Run("allows url change on the same host without a new token", func(t *testing.T) {
		result, err := updateRepositoryURL(t, helper, repoName, "https://github.com/grafana/repo-b")
		require.NoError(t, err)

		stored := common.MustFromUnstructured[provisioning.Repository](t, result)
		assert.Equal(t, "https://github.com/grafana/repo-b", stored.Spec.GitHub.URL)

		// A GitHub App token is scoped to the repository it was minted for, so the old one
		// cannot reach repo-b. The controller has to replace it rather than keep it.
		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			current, err := helper.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
			require.NoError(collect, err)
			reconciled := common.MustFromUnstructured[provisioning.Repository](t, current)
			require.NotEmpty(collect, reconciled.Secure.Token.Name, "a token should be stored again")
			require.Greater(collect, reconciled.Status.Token.LastUpdated, mintedAt,
				"token should be re-minted for the new repository")
		}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "token should be regenerated after the url change")
	})

	// A host change is never silently accepted. Which guard rejects it first depends on
	// whether the host resolves, so the exact message is pinned by the unit tests instead.
	t.Run("rejects host change without a new token", func(t *testing.T) {
		_, err := updateRepositoryURL(t, helper, repoName, "https://ghe.example.com/grafana/repo-b")
		require.Error(t, err)
		require.True(t, apierrors.IsInvalid(err), "expected invalid repository update, got %v", err)

		current, err := helper.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
		require.NoError(t, err)
		stored := common.MustFromUnstructured[provisioning.Repository](t, current)
		assert.Equal(t, "https://github.com/grafana/repo-b", stored.Spec.GitHub.URL, "url must not have moved host")
	})
}

// updateRepositoryURL repoints the stored repository at url, sending no secure values at
// all, which mirrors a client that only ever sends the spec. The repository is re-read on
// conflict because the controller patches status concurrently.
func updateRepositoryURL(
	t *testing.T,
	helper *common.ProvisioningTestHelper,
	name string,
	url string,
) (*unstructured.Unstructured, error) {
	t.Helper()

	var result *unstructured.Unstructured
	err := common.RetryOnConflict(t, func() error {
		current, err := helper.Repositories.Resource.Get(t.Context(), name, metav1.GetOptions{})
		if err != nil {
			return err
		}

		updated := current.DeepCopy()
		if err := unstructured.SetNestedField(updated.Object, url, "spec", "github", "url"); err != nil {
			return err
		}
		unstructured.RemoveNestedField(updated.Object, "secure")

		result, err = helper.Repositories.Resource.Update(t.Context(), updated, metav1.UpdateOptions{})
		return err
	})

	return result, err
}
