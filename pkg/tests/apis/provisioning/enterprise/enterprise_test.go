package enterprise

import (
	"context"
	"encoding/base64"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	clientset "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// newFakeGHEServer starts a loopback HTTP server that stands in as a GitHub Enterprise
// endpoint, returning a healthy app/installation under the enterprise /api/v3 base path.
// Point a connection's spec.githubEnterprise.serverUrl at server.URL so the controller's
// Connection.Test resolves against loopback instead of dialing a real (unreachable) host.
// This avoids mutating the shared GitHub factory's in-memory client, which the controller
// goroutine doesn't reliably observe (that race made the in-memory mock flaky in CI).
// The app ID (123) and installation ID (456) match the connections created in these tests.
func newFakeGHEServer(t *testing.T) *httptest.Server {
	t.Helper()

	const perms = `{"contents":"write","metadata":"read","pull_requests":"write","repository_hooks":"write"}`
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.URL.Path == "/api/v3/app":
			_, _ = fmt.Fprintf(w, `{"id":123,"slug":"test-app","permissions":%s}`, perms)
		case strings.HasPrefix(r.URL.Path, "/api/v3/app/installations/"):
			_, _ = fmt.Fprintf(w, `{"id":456,"permissions":%s}`, perms)
		default:
			w.WriteHeader(http.StatusOK)
		}
	}))
	t.Cleanup(server.Close)
	return server
}

func TestIntegrationProvisioning_ConnectionEnterpriseMutation(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	gitlabNamePrefix := fmt.Sprintf("%s-", provisioning.GitlabConnectionType)
	bitbucketNamePrefix := fmt.Sprintf("%s-", provisioning.BitbucketConnectionType)
	gheNamePrefix := fmt.Sprintf("%s-", provisioning.GithubEnterpriseConnectionType)
	privateKeyBase64 := common.TestGithubPrivateKeyBase64()

	// The mutation tests create valid githubEnterprise connections which the controller
	// then reconciles via the shared GitHub Connection.Test(). Point serverUrl at a loopback
	// server so that background reconcile stays in-process and never dials a real host.
	gheServer := newFakeGHEServer(t)

	t.Run("should update gitlab connection name with type prefix", func(t *testing.T) {
		connection := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Connection",
			"metadata": map[string]any{
				"namespace": "default",
			},
			"spec": map[string]any{
				"title": "Test Connection",
				"type":  provisioning.GitlabConnectionType,
				"gitlab": map[string]any{
					"clientID": "123456",
				},
			},
			"secure": map[string]any{
				"clientSecret": map[string]any{
					"create": "someSecret",
				},
			},
		}}

		c, err := helper.Connections.Resource.Create(ctx, connection, metav1.CreateOptions{FieldValidation: "Strict"})
		require.NoError(t, err, "failed to create resource")
		require.Contains(t, c.GetName(), gitlabNamePrefix, "name should be updated")

		t.Cleanup(func() {
			require.EventuallyWithT(t, func(collect *assert.CollectT) {
				err := helper.Connections.Resource.Delete(ctx, c.GetName(), metav1.DeleteOptions{})
				require.NoError(collect, err)
			}, common.WaitTimeoutDefault, common.WaitIntervalDefault)
		})
	})

	t.Run("should update gitlab connection name with given prefix", func(t *testing.T) {
		generateName := "some-name-"
		connection := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Connection",
			"metadata": map[string]any{
				"namespace":    "default",
				"generateName": generateName,
			},
			"spec": map[string]any{
				"title": "Test Connection",
				"type":  provisioning.GitlabConnectionType,
				"gitlab": map[string]any{
					"clientID": "123456",
				},
			},
			"secure": map[string]any{
				"clientSecret": map[string]any{
					"create": "someSecret",
				},
			},
		}}

		c, err := helper.Connections.Resource.Create(ctx, connection, metav1.CreateOptions{FieldValidation: "Strict"})
		require.NoError(t, err, "failed to create resource")
		require.Contains(t, c.GetName(), generateName, "name should be updated")

		t.Cleanup(func() {
			require.EventuallyWithT(t, func(collect *assert.CollectT) {
				err := helper.Connections.Resource.Delete(ctx, c.GetName(), metav1.DeleteOptions{})
				require.NoError(collect, err)
			}, common.WaitTimeoutDefault, common.WaitIntervalDefault)
		})
	})

	t.Run("should keep gitlab connection name if name is already given", func(t *testing.T) {
		name := "some-name"
		connection := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Connection",
			"metadata": map[string]any{
				"name":      name,
				"namespace": "default",
			},
			"spec": map[string]any{
				"title": "Test Connection",
				"type":  provisioning.GitlabConnectionType,
				"gitlab": map[string]any{
					"clientID": "123456",
				},
			},
			"secure": map[string]any{
				"clientSecret": map[string]any{
					"create": "someSecret",
				},
			},
		}}

		c, err := helper.Connections.Resource.Create(ctx, connection, metav1.CreateOptions{FieldValidation: "Strict"})
		require.NoError(t, err, "failed to create resource")
		require.Equal(t, name, c.GetName(), "name should be identical")

		t.Cleanup(func() {
			require.EventuallyWithT(t, func(collect *assert.CollectT) {
				err := helper.Connections.Resource.Delete(ctx, c.GetName(), metav1.DeleteOptions{})
				require.NoError(collect, err)
			}, common.WaitTimeoutDefault, common.WaitIntervalDefault)
		})
	})

	t.Run("should update bitbucket connection name with type prefix", func(t *testing.T) {
		connection := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Connection",
			"metadata": map[string]any{
				"namespace": "default",
			},
			"spec": map[string]any{
				"title": "Test Connection",
				"type":  provisioning.BitbucketConnectionType,
				"bitbucket": map[string]any{
					"clientID": "123456",
				},
			},
			"secure": map[string]any{
				"clientSecret": map[string]any{
					"create": "someSecret",
				},
			},
		}}

		c, err := helper.Connections.Resource.Create(ctx, connection, metav1.CreateOptions{FieldValidation: "Strict"})
		require.NoError(t, err, "failed to create resource")
		require.Contains(t, c.GetName(), bitbucketNamePrefix, "name should be updated")

		t.Cleanup(func() {
			require.EventuallyWithT(t, func(collect *assert.CollectT) {
				err := helper.Connections.Resource.Delete(ctx, c.GetName(), metav1.DeleteOptions{})
				require.NoError(collect, err)
			}, common.WaitTimeoutDefault, common.WaitIntervalDefault)
		})
	})

	t.Run("should update bitbucket connection name with given prefix", func(t *testing.T) {
		generateName := "some-name-"
		connection := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Connection",
			"metadata": map[string]any{
				"namespace":    "default",
				"generateName": generateName,
			},
			"spec": map[string]any{
				"title": "Test Connection",
				"type":  provisioning.BitbucketConnectionType,
				"bitbucket": map[string]any{
					"clientID": "123456",
				},
			},
			"secure": map[string]any{
				"clientSecret": map[string]any{
					"create": "someSecret",
				},
			},
		}}

		c, err := helper.Connections.Resource.Create(ctx, connection, metav1.CreateOptions{FieldValidation: "Strict"})
		require.NoError(t, err, "failed to create resource")
		require.Contains(t, c.GetName(), generateName, "name should be updated")

		t.Cleanup(func() {
			require.EventuallyWithT(t, func(collect *assert.CollectT) {
				err := helper.Connections.Resource.Delete(ctx, c.GetName(), metav1.DeleteOptions{})
				require.NoError(collect, err)
			}, common.WaitTimeoutDefault, common.WaitIntervalDefault)
		})
	})

	t.Run("should keep bitbucket connection name if name is already given", func(t *testing.T) {
		name := "some-name"
		connection := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Connection",
			"metadata": map[string]any{
				"name":      name,
				"namespace": "default",
			},
			"spec": map[string]any{
				"title": "Test Connection",
				"type":  provisioning.BitbucketConnectionType,
				"bitbucket": map[string]any{
					"clientID": "123456",
				},
			},
			"secure": map[string]any{
				"clientSecret": map[string]any{
					"create": "someSecret",
				},
			},
		}}

		c, err := helper.Connections.Resource.Create(ctx, connection, metav1.CreateOptions{FieldValidation: "Strict"})
		require.NoError(t, err, "failed to create resource")
		require.Equal(t, name, c.GetName(), "name should be identical")

		t.Cleanup(func() {
			require.EventuallyWithT(t, func(collect *assert.CollectT) {
				err := helper.Connections.Resource.Delete(ctx, c.GetName(), metav1.DeleteOptions{})
				require.NoError(collect, err)
			}, common.WaitTimeoutDefault, common.WaitIntervalDefault)
		})
	})

	newGHEConnection := func(meta map[string]any, serverURL string) *unstructured.Unstructured {
		return &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Connection",
			"metadata":   meta,
			"spec": map[string]any{
				"title": "Test Connection",
				"type":  provisioning.GithubEnterpriseConnectionType,
				"githubEnterprise": map[string]any{
					"appID":          "123",
					"installationID": "456",
					"serverUrl":      serverURL,
				},
			},
			"secure": map[string]any{
				"privateKey": map[string]any{
					"create": privateKeyBase64,
				},
			},
		}}
	}

	t.Run("should update githubEnterprise connection name with type prefix", func(t *testing.T) {
		connection := newGHEConnection(map[string]any{
			"namespace": "default",
		}, gheServer.URL)

		c, err := helper.Connections.Resource.Create(ctx, connection, metav1.CreateOptions{FieldValidation: "Strict"})
		require.NoError(t, err, "failed to create resource")
		require.Contains(t, c.GetName(), gheNamePrefix, "name should be updated")

		t.Cleanup(func() {
			require.EventuallyWithT(t, func(collect *assert.CollectT) {
				err := helper.Connections.Resource.Delete(ctx, c.GetName(), metav1.DeleteOptions{})
				require.NoError(collect, err)
			}, common.WaitTimeoutDefault, common.WaitIntervalDefault)
		})
	})

	t.Run("should update githubEnterprise connection name with given prefix", func(t *testing.T) {
		generateName := "some-name-"
		connection := newGHEConnection(map[string]any{
			"namespace":    "default",
			"generateName": generateName,
		}, gheServer.URL)

		c, err := helper.Connections.Resource.Create(ctx, connection, metav1.CreateOptions{FieldValidation: "Strict"})
		require.NoError(t, err, "failed to create resource")
		require.Contains(t, c.GetName(), generateName, "name should be updated")

		t.Cleanup(func() {
			require.EventuallyWithT(t, func(collect *assert.CollectT) {
				err := helper.Connections.Resource.Delete(ctx, c.GetName(), metav1.DeleteOptions{})
				require.NoError(collect, err)
			}, common.WaitTimeoutDefault, common.WaitIntervalDefault)
		})
	})

	t.Run("should keep githubEnterprise connection name if name is already given", func(t *testing.T) {
		name := "some-name"
		connection := newGHEConnection(map[string]any{
			"name":      name,
			"namespace": "default",
		}, gheServer.URL)

		c, err := helper.Connections.Resource.Create(ctx, connection, metav1.CreateOptions{FieldValidation: "Strict"})
		require.NoError(t, err, "failed to create resource")
		require.Equal(t, name, c.GetName(), "name should be identical")

		t.Cleanup(func() {
			require.EventuallyWithT(t, func(collect *assert.CollectT) {
				err := helper.Connections.Resource.Delete(ctx, c.GetName(), metav1.DeleteOptions{})
				require.NoError(collect, err)
			}, common.WaitTimeoutDefault, common.WaitIntervalDefault)
		})
	})

	t.Run("should trim trailing slash from githubEnterprise serverUrl", func(t *testing.T) {
		connection := newGHEConnection(map[string]any{
			"namespace": "default",
		}, gheServer.URL+"/")

		c, err := helper.Connections.Resource.Create(ctx, connection, metav1.CreateOptions{FieldValidation: "Strict"})
		require.NoError(t, err, "failed to create resource")

		spec := c.Object["spec"].(map[string]any)
		ghe := spec["githubEnterprise"].(map[string]any)
		assert.Equal(t, gheServer.URL, ghe["serverUrl"], "trailing slash should be trimmed")

		t.Cleanup(func() {
			require.EventuallyWithT(t, func(collect *assert.CollectT) {
				err := helper.Connections.Resource.Delete(ctx, c.GetName(), metav1.DeleteOptions{})
				require.NoError(collect, err)
			}, common.WaitTimeoutDefault, common.WaitIntervalDefault)
		})
	})
}

func TestIntegrationProvisioning_ConnectionEnterpriseValidation(t *testing.T) {
	helper := sharedHelper(t)
	createOptions := metav1.CreateOptions{FieldValidation: "Strict"}
	ctx := context.Background()

	t.Run("should fail when type is bitbucket but 'bitbucket' field is not there", func(t *testing.T) {
		connection := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Connection",
			"metadata": map[string]any{
				"name":      "connection",
				"namespace": "default",
			},
			"spec": map[string]any{
				"title": "Test Connection",
				"type":  "bitbucket",
			},
			"secure": map[string]any{
				"clientSecret": map[string]any{
					"create": "someSecret",
				},
			},
		}}
		_, err := helper.Connections.Resource.Create(ctx, connection, createOptions)
		require.Error(t, err, "failed to create resource")
		assert.Contains(t, err.Error(), "bitbucket info must be specified in Bitbucket connection")
	})

	t.Run("should fail when type is bitbucket but client secret is not there", func(t *testing.T) {
		connection := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Connection",
			"metadata": map[string]any{
				"name":      "connection",
				"namespace": "default",
			},
			"spec": map[string]any{
				"title": "Test Connection",
				"type":  "bitbucket",
				"bitbucket": map[string]any{
					"clientID": "123456",
				},
			},
		}}
		_, err := helper.Connections.Resource.Create(ctx, connection, createOptions)
		require.Error(t, err, "failed to create resource")
		assert.Contains(t, err.Error(), "clientSecret must be specified for Bitbucket connection")
	})

	t.Run("should fail when type is bitbucket but a private key is specified", func(t *testing.T) {
		connection := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Connection",
			"metadata": map[string]any{
				"name":      "connection",
				"namespace": "default",
			},
			"spec": map[string]any{
				"title": "Test Connection",
				"type":  "bitbucket",
				"bitbucket": map[string]any{
					"clientID": "123456",
				},
			},
			"secure": map[string]any{
				"privateKey": map[string]any{
					"create": "someSecret",
				},
				"clientSecret": map[string]any{
					"create": "someSecret",
				},
			},
		}}
		_, err := helper.Connections.Resource.Create(ctx, connection, createOptions)
		require.Error(t, err, "failed to create resource")
		assert.Contains(t, err.Error(), "privateKey is forbidden in Bitbucket connection")
	})

	t.Run("should fail when type is gitlab but 'gitlab' field is not there", func(t *testing.T) {
		connection := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Connection",
			"metadata": map[string]any{
				"name":      "connection",
				"namespace": "default",
			},
			"spec": map[string]any{
				"title": "Test Connection",
				"type":  "gitlab",
			},
			"secure": map[string]any{
				"clientSecret": map[string]any{
					"create": "someSecret",
				},
			},
		}}
		_, err := helper.Connections.Resource.Create(ctx, connection, createOptions)
		require.Error(t, err, "failed to create resource")
		assert.Contains(t, err.Error(), "gitlab info must be specified in Gitlab connection")
	})

	t.Run("should fail when type is gitlab but client secret is not there", func(t *testing.T) {
		connection := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Connection",
			"metadata": map[string]any{
				"name":      "connection",
				"namespace": "default",
			},
			"spec": map[string]any{
				"title": "Test Connection",
				"type":  "gitlab",
				"gitlab": map[string]any{
					"clientID": "123456",
				},
			},
		}}
		_, err := helper.Connections.Resource.Create(ctx, connection, createOptions)
		require.Error(t, err, "failed to create resource")
		assert.Contains(t, err.Error(), "clientSecret must be specified for Gitlab connection")
	})

	t.Run("should fail when type is gitlab but a private key is specified", func(t *testing.T) {
		connection := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Connection",
			"metadata": map[string]any{
				"name":      "connection",
				"namespace": "default",
			},
			"spec": map[string]any{
				"title": "Test Connection",
				"type":  "gitlab",
				"gitlab": map[string]any{
					"clientID": "123456",
				},
			},
			"secure": map[string]any{
				"privateKey": map[string]any{
					"create": "someSecret",
				},
				"clientSecret": map[string]any{
					"create": "someSecret",
				},
			},
		}}
		_, err := helper.Connections.Resource.Create(ctx, connection, createOptions)
		require.Error(t, err, "failed to create resource")
		assert.Contains(t, err.Error(), "privateKey is forbidden in Gitlab connection")
	})

	privateKeyBase64 := common.TestGithubPrivateKeyBase64()

	t.Run("should fail when type is githubEnterprise but 'githubEnterprise' field is not there", func(t *testing.T) {
		connection := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Connection",
			"metadata": map[string]any{
				"name":      "connection",
				"namespace": "default",
			},
			"spec": map[string]any{
				"title": "Test Connection",
				"type":  string(provisioning.GithubEnterpriseConnectionType),
			},
			"secure": map[string]any{
				"privateKey": map[string]any{
					"create": privateKeyBase64,
				},
			},
		}}
		_, err := helper.Connections.Resource.Create(ctx, connection, createOptions)
		require.Error(t, err, "failed to create resource")
		assert.Contains(t, err.Error(), "githubEnterprise info must be specified for githubEnterprise connection")
	})

	t.Run("should fail when type is githubEnterprise but serverUrl is not there", func(t *testing.T) {
		connection := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Connection",
			"metadata": map[string]any{
				"name":      "connection",
				"namespace": "default",
			},
			"spec": map[string]any{
				"title": "Test Connection",
				"type":  string(provisioning.GithubEnterpriseConnectionType),
				"githubEnterprise": map[string]any{
					"appID":          "123",
					"installationID": "456",
				},
			},
			"secure": map[string]any{
				"privateKey": map[string]any{
					"create": privateKeyBase64,
				},
			},
		}}
		_, err := helper.Connections.Resource.Create(ctx, connection, createOptions)
		require.Error(t, err, "failed to create resource")
		assert.Contains(t, err.Error(), "serverUrl must be specified for githubEnterprise connection")
	})

	t.Run("should fail when type is githubEnterprise but serverUrl has an invalid scheme", func(t *testing.T) {
		connection := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Connection",
			"metadata": map[string]any{
				"name":      "connection",
				"namespace": "default",
			},
			"spec": map[string]any{
				"title": "Test Connection",
				"type":  string(provisioning.GithubEnterpriseConnectionType),
				"githubEnterprise": map[string]any{
					"appID":          "123",
					"installationID": "456",
					"serverUrl":      "ftp://ghe.example.com",
				},
			},
			"secure": map[string]any{
				"privateKey": map[string]any{
					"create": privateKeyBase64,
				},
			},
		}}
		_, err := helper.Connections.Resource.Create(ctx, connection, createOptions)
		require.Error(t, err, "failed to create resource")
		assert.Contains(t, err.Error(), "URL must start with https:// or http://")
	})

	t.Run("should fail when type is githubEnterprise but private key is not there", func(t *testing.T) {
		connection := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Connection",
			"metadata": map[string]any{
				"name":      "connection",
				"namespace": "default",
			},
			"spec": map[string]any{
				"title": "Test Connection",
				"type":  string(provisioning.GithubEnterpriseConnectionType),
				"githubEnterprise": map[string]any{
					"appID":          "123",
					"installationID": "456",
					"serverUrl":      "https://ghe.example.com",
				},
			},
		}}
		_, err := helper.Connections.Resource.Create(ctx, connection, createOptions)
		require.Error(t, err, "failed to create resource")
		assert.Contains(t, err.Error(), "privateKey must be specified for GitHub Enterprise connection")
	})

	t.Run("should fail when type is githubEnterprise but a client secret is specified", func(t *testing.T) {
		connection := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Connection",
			"metadata": map[string]any{
				"name":      "connection",
				"namespace": "default",
			},
			"spec": map[string]any{
				"title": "Test Connection",
				"type":  string(provisioning.GithubEnterpriseConnectionType),
				"githubEnterprise": map[string]any{
					"appID":          "123",
					"installationID": "456",
					"serverUrl":      "https://ghe.example.com",
				},
			},
			"secure": map[string]any{
				"privateKey": map[string]any{
					"create": privateKeyBase64,
				},
				"clientSecret": map[string]any{
					"create": "someSecret",
				},
			},
		}}
		_, err := helper.Connections.Resource.Create(ctx, connection, createOptions)
		require.Error(t, err, "failed to create resource")
		assert.Contains(t, err.Error(), "clientSecret is forbidden in GitHub Enterprise connection")
	})

	t.Run("should fail when type is githubEnterprise but appID is not numeric", func(t *testing.T) {
		connection := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Connection",
			"metadata": map[string]any{
				"name":      "connection",
				"namespace": "default",
			},
			"spec": map[string]any{
				"title": "Test Connection",
				"type":  string(provisioning.GithubEnterpriseConnectionType),
				"githubEnterprise": map[string]any{
					"appID":          "not-a-number",
					"installationID": "456",
					"serverUrl":      "https://ghe.example.com",
				},
			},
			"secure": map[string]any{
				"privateKey": map[string]any{
					"create": privateKeyBase64,
				},
			},
		}}
		_, err := helper.Connections.Resource.Create(ctx, connection, createOptions)
		require.Error(t, err, "failed to create resource")
		assert.Contains(t, err.Error(), "appID must be a numeric value")
	})

	t.Run("should fail when type is githubEnterprise but installationID is not numeric", func(t *testing.T) {
		connection := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Connection",
			"metadata": map[string]any{
				"name":      "connection",
				"namespace": "default",
			},
			"spec": map[string]any{
				"title": "Test Connection",
				"type":  string(provisioning.GithubEnterpriseConnectionType),
				"githubEnterprise": map[string]any{
					"appID":          "123",
					"installationID": "not-a-number",
					"serverUrl":      "https://ghe.example.com",
				},
			},
			"secure": map[string]any{
				"privateKey": map[string]any{
					"create": privateKeyBase64,
				},
			},
		}}
		_, err := helper.Connections.Resource.Create(ctx, connection, createOptions)
		require.Error(t, err, "failed to create resource")
		assert.Contains(t, err.Error(), "installationID must be a numeric value")
	})
}

func TestIntegrationConnectionController_EnterpriseWiring(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	t.Run("GitLab connection can be created and reconciled", func(t *testing.T) {
		clientSecret := base64.StdEncoding.EncodeToString([]byte("test-client-secret"))

		connection := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Connection",
			"metadata": map[string]any{
				"name":      "test-gitlab-connection",
				"namespace": "default",
			},
			"spec": map[string]any{
				"title": "Test GitLab Connection",
				"type":  string(provisioning.GitlabConnectionType),
				"url":   "https://gitlab.com",
				"gitlab": map[string]any{
					"clientID": "test-client-id",
				},
			},
			"secure": map[string]any{
				"clientSecret": map[string]any{
					"create": clientSecret,
				},
			},
		}}

		created, err := helper.Connections.Resource.Create(ctx, connection, metav1.CreateOptions{})
		require.NoError(t, err, "failed to create GitLab connection")
		require.NotNil(t, created)

		connectionName := created.GetName()
		require.NotEmpty(t, connectionName, "connection name should not be empty")
		t.Cleanup(func() {
			if err := helper.Connections.Resource.Delete(ctx, connectionName, metav1.DeleteOptions{}); err != nil && !apierrors.IsNotFound(err) {
				t.Errorf("cleanup: failed to delete GitLab connection %q: %v", connectionName, err)
			}
		})

		output, err := helper.Connections.Resource.Get(ctx, connectionName, metav1.GetOptions{})
		require.NoError(t, err, "failed to read back GitLab connection")
		assert.Equal(t, connectionName, output.GetName(), "name should be equal")

		spec := output.Object["spec"].(map[string]any)
		assert.Equal(t, string(provisioning.GitlabConnectionType), spec["type"], "type should be gitlab")

		restConfig := helper.Org1.Admin.NewRestConfig()
		provClient, err := clientset.NewForConfig(restConfig)
		require.NoError(t, err, "failed to create provisioning client")
		connClient := provClient.ProvisioningV0alpha1().Connections("default")

		require.Eventually(t, func() bool {
			updated, err := connClient.Get(ctx, connectionName, metav1.GetOptions{})
			if err != nil {
				return false
			}
			return updated.Status.ObservedGeneration == updated.Generation &&
				updated.Status.Health.Checked > 0
		}, 15*time.Second, 500*time.Millisecond, "connection should be reconciled by controller")

		reconciled, err := connClient.Get(ctx, connectionName, metav1.GetOptions{})
		require.NoError(t, err)

		assert.Equal(t, reconciled.Generation, reconciled.Status.ObservedGeneration,
			"controller should have reconciled the connection")
		assert.Greater(t, reconciled.Status.Health.Checked, int64(0),
			"health check should have been attempted")

		readyCondition := meta.FindStatusCondition(reconciled.Status.Conditions, provisioning.ConditionTypeReady)
		assert.NotNil(t, readyCondition, "should have ready condition")

		t.Logf("GitLab connection reconciled successfully. Health: %v, ObservedGen: %d, Checked: %d",
			reconciled.Status.Health.Healthy, reconciled.Status.ObservedGeneration, reconciled.Status.Health.Checked)
	})

	t.Run("Bitbucket connection can be created and reconciled", func(t *testing.T) {
		clientSecret := base64.StdEncoding.EncodeToString([]byte("test-client-secret"))

		connection := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Connection",
			"metadata": map[string]any{
				"name":      "test-bitbucket-connection",
				"namespace": "default",
			},
			"spec": map[string]any{
				"title": "Test Bitbucket Connection",
				"type":  string(provisioning.BitbucketConnectionType),
				"bitbucket": map[string]any{
					"clientID": "test-client-id",
				},
			},
			"secure": map[string]any{
				"clientSecret": map[string]any{
					"create": clientSecret,
				},
			},
		}}

		created, err := helper.Connections.Resource.Create(ctx, connection, metav1.CreateOptions{})
		require.NoError(t, err, "failed to create Bitbucket connection")
		require.NotNil(t, created)

		connectionName := created.GetName()
		require.NotEmpty(t, connectionName, "connection name should not be empty")
		t.Cleanup(func() {
			if err := helper.Connections.Resource.Delete(ctx, connectionName, metav1.DeleteOptions{}); err != nil && !apierrors.IsNotFound(err) {
				t.Errorf("cleanup: failed to delete Bitbucket connection %q: %v", connectionName, err)
			}
		})

		output, err := helper.Connections.Resource.Get(ctx, connectionName, metav1.GetOptions{})
		require.NoError(t, err, "failed to read back Bitbucket connection")
		assert.Equal(t, connectionName, output.GetName(), "name should be equal")

		spec := output.Object["spec"].(map[string]any)
		assert.Equal(t, string(provisioning.BitbucketConnectionType), spec["type"], "type should be bitbucket")

		restConfig := helper.Org1.Admin.NewRestConfig()
		provClient, err := clientset.NewForConfig(restConfig)
		require.NoError(t, err, "failed to create provisioning client")
		connClient := provClient.ProvisioningV0alpha1().Connections("default")

		require.Eventually(t, func() bool {
			updated, err := connClient.Get(ctx, connectionName, metav1.GetOptions{})
			if err != nil {
				return false
			}
			return updated.Status.ObservedGeneration == updated.Generation &&
				updated.Status.Health.Checked > 0
		}, 15*time.Second, 500*time.Millisecond, "connection should be reconciled by controller")

		reconciled, err := connClient.Get(ctx, connectionName, metav1.GetOptions{})
		require.NoError(t, err)

		assert.Equal(t, reconciled.Generation, reconciled.Status.ObservedGeneration,
			"controller should have reconciled the connection")
		assert.Greater(t, reconciled.Status.Health.Checked, int64(0),
			"health check should have been attempted")

		readyCondition := meta.FindStatusCondition(reconciled.Status.Conditions, provisioning.ConditionTypeReady)
		assert.NotNil(t, readyCondition, "should have ready condition")

		t.Logf("Bitbucket connection reconciled successfully. Health: %v, ObservedGen: %d, Checked: %d",
			reconciled.Status.Health.Healthy, reconciled.Status.ObservedGeneration, reconciled.Status.Health.Checked)
	})

	t.Run("GitHub Enterprise connection can be created and reconciled", func(t *testing.T) {
		privateKeyBase64 := common.TestGithubPrivateKeyBase64()

		// Point serverUrl at a loopback server so the controller's Connection.Test resolves
		// in-process and exercises the enterprise /api/v3 URL path, instead of dialing a real
		// (unreachable) host. See newFakeGHEServer for why this is preferred over mocking the
		// shared GitHub factory's in-memory client.
		ghServer := newFakeGHEServer(t)

		connection := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Connection",
			"metadata": map[string]any{
				"name":      "test-ghe-connection",
				"namespace": "default",
			},
			"spec": map[string]any{
				"title": "Test GitHub Enterprise Connection",
				"type":  string(provisioning.GithubEnterpriseConnectionType),
				"githubEnterprise": map[string]any{
					"appID":          "123",
					"installationID": "456",
					"serverUrl":      ghServer.URL,
				},
			},
			"secure": map[string]any{
				"privateKey": map[string]any{
					"create": privateKeyBase64,
				},
			},
		}}

		created, err := helper.Connections.Resource.Create(ctx, connection, metav1.CreateOptions{})
		require.NoError(t, err, "failed to create GitHub Enterprise connection")
		require.NotNil(t, created)

		connectionName := created.GetName()
		require.NotEmpty(t, connectionName, "connection name should not be empty")
		t.Cleanup(func() {
			if err := helper.Connections.Resource.Delete(ctx, connectionName, metav1.DeleteOptions{}); err != nil && !apierrors.IsNotFound(err) {
				t.Errorf("cleanup: failed to delete GitHub Enterprise connection %q: %v", connectionName, err)
			}
		})

		output, err := helper.Connections.Resource.Get(ctx, connectionName, metav1.GetOptions{})
		require.NoError(t, err, "failed to read back GitHub Enterprise connection")
		assert.Equal(t, connectionName, output.GetName(), "name should be equal")

		spec := output.Object["spec"].(map[string]any)
		assert.Equal(t, string(provisioning.GithubEnterpriseConnectionType), spec["type"], "type should be githubEnterprise")

		restConfig := helper.Org1.Admin.NewRestConfig()
		provClient, err := clientset.NewForConfig(restConfig)
		require.NoError(t, err, "failed to create provisioning client")
		connClient := provClient.ProvisioningV0alpha1().Connections("default")

		// Capture the last observed connection so that, on timeout, we can report the
		// actual reason (hang => Checked==0; unhealthy => a Health.Message/fieldErrors;
		// reconcile error => stale ObservedGeneration) instead of a bare "never satisfied".
		var last *provisioning.Connection
		ok := assert.Eventually(t, func() bool {
			updated, err := connClient.Get(ctx, connectionName, metav1.GetOptions{})
			if err != nil {
				t.Logf("GHE poll: get error: %v", err)
				return false
			}
			last = updated
			if msg := updated.Status.Health.Message; len(msg) > 0 || updated.Status.Health.Error != "" {
				t.Logf("GHE poll: healthy=%v checked=%d error=%q message=%v",
					updated.Status.Health.Healthy, updated.Status.Health.Checked,
					updated.Status.Health.Error, msg)
			}
			ready := meta.FindStatusCondition(updated.Status.Conditions, provisioning.ConditionTypeReady)
			return updated.Status.Health.Checked > 0 &&
				updated.Status.Health.Healthy &&
				ready != nil && ready.Status == metav1.ConditionTrue
		}, 30*time.Second, 500*time.Millisecond, "GHE connection should reconcile healthy")

		if !ok {
			if last != nil {
				ready := meta.FindStatusCondition(last.Status.Conditions, provisioning.ConditionTypeReady)
				t.Fatalf("GHE connection never reconciled healthy. gen=%d observedGen=%d health.checked=%d health.healthy=%v health.error=%q health.message=%v fieldErrors=%+v ready=%+v",
					last.Generation, last.Status.ObservedGeneration,
					last.Status.Health.Checked, last.Status.Health.Healthy,
					last.Status.Health.Error, last.Status.Health.Message,
					last.Status.FieldErrors, ready)
			}
			t.Fatalf("GHE connection never reconciled healthy and was never observed")
		}

		readyCondition := meta.FindStatusCondition(last.Status.Conditions, provisioning.ConditionTypeReady)
		require.NotNil(t, readyCondition, "should have ready condition")
		assert.Equal(t, metav1.ConditionTrue, readyCondition.Status, "connection should be ready")

		t.Logf("GitHub Enterprise connection reconciled. Health: %v, Checked: %d",
			last.Status.Health.Healthy, last.Status.Health.Checked)
	})

	t.Run("All connection types are supported", func(t *testing.T) {
		supportedTypes := []provisioning.ConnectionType{
			provisioning.GithubConnectionType,
			provisioning.GitlabConnectionType,
			provisioning.BitbucketConnectionType,
			provisioning.GithubEnterpriseConnectionType,
		}

		for _, connType := range supportedTypes {
			t.Run(string(connType), func(t *testing.T) {
				conn := &unstructured.Unstructured{Object: map[string]any{
					"apiVersion": "provisioning.grafana.app/v0alpha1",
					"kind":       "Connection",
					"metadata": map[string]any{
						"generateName": "test-",
						"namespace":    "default",
					},
					"spec": map[string]any{
						"title": "Test Connection",
						"type":  string(connType),
					},
				}}

				created, err := helper.Connections.Resource.Create(ctx, conn, metav1.CreateOptions{})
				if err != nil {
					assert.NotContains(t, err.Error(), "is not supported",
						"type %s should be supported by factory", connType)
					return
				}
				t.Cleanup(func() {
					if err := helper.Connections.Resource.Delete(ctx, created.GetName(), metav1.DeleteOptions{}); err != nil && !apierrors.IsNotFound(err) {
						t.Errorf("cleanup: failed to delete connection %q: %v", created.GetName(), err)
					}
				})
			})
		}
	})
}

func TestIntegrationRepositoryController_EnterpriseWiring(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	t.Run("GitLab repository can be created and reconciled", func(t *testing.T) {
		token := base64.StdEncoding.EncodeToString([]byte("test-gitlab-token"))

		repository := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Repository",
			"metadata": map[string]any{
				"name":      "test-gitlab-repo",
				"namespace": "default",
			},
			"spec": map[string]any{
				"title": "Test GitLab Repository",
				"type":  string(provisioning.GitLabRepositoryType),
				"gitlab": map[string]any{
					"url":    "https://gitlab.com/test/repo.git",
					"branch": "main",
					"path":   "dashboards",
				},
			},
			"secure": map[string]any{
				"token": map[string]any{
					"create": token,
				},
			},
		}}

		created, err := helper.Repositories.Resource.Create(ctx, repository, metav1.CreateOptions{})
		require.NoError(t, err, "failed to create GitLab repository")
		require.NotNil(t, created)

		repoName := created.GetName()
		require.NotEmpty(t, repoName, "repository name should not be empty")

		t.Cleanup(func() {
			_ = helper.Repositories.Resource.Delete(ctx, repoName, metav1.DeleteOptions{})
		})

		output, err := helper.Repositories.Resource.Get(ctx, repoName, metav1.GetOptions{})
		require.NoError(t, err, "failed to read back GitLab repository")
		assert.Equal(t, repoName, output.GetName(), "name should be equal")

		spec := output.Object["spec"].(map[string]any)
		assert.Equal(t, string(provisioning.GitLabRepositoryType), spec["type"], "type should be gitlab")

		restConfig := helper.Org1.Admin.NewRestConfig()
		provClient, err := clientset.NewForConfig(restConfig)
		require.NoError(t, err, "failed to create provisioning client")
		repoClient := provClient.ProvisioningV0alpha1().Repositories("default")

		require.Eventually(t, func() bool {
			updated, err := repoClient.Get(ctx, repoName, metav1.GetOptions{})
			if err != nil {
				return false
			}
			return updated.Status.ObservedGeneration == updated.Generation &&
				updated.Status.Health.Checked > 0
		}, 15*time.Second, 500*time.Millisecond, "repository should be reconciled by controller")

		reconciled, err := repoClient.Get(ctx, repoName, metav1.GetOptions{})
		require.NoError(t, err)

		assert.Equal(t, reconciled.Generation, reconciled.Status.ObservedGeneration,
			"controller should have reconciled the repository")
		assert.Greater(t, reconciled.Status.Health.Checked, int64(0),
			"health check should have been attempted")

		readyCondition := meta.FindStatusCondition(reconciled.Status.Conditions, provisioning.ConditionTypeReady)
		assert.NotNil(t, readyCondition, "should have ready condition")

		t.Logf("GitLab repository reconciled successfully. Health: %v, ObservedGen: %d, Checked: %d",
			reconciled.Status.Health.Healthy, reconciled.Status.ObservedGeneration, reconciled.Status.Health.Checked)
	})

	t.Run("Bitbucket repository can be created and reconciled", func(t *testing.T) {
		token := base64.StdEncoding.EncodeToString([]byte("test-bitbucket-token"))

		repository := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Repository",
			"metadata": map[string]any{
				"name":      "test-bitbucket-repo",
				"namespace": "default",
			},
			"spec": map[string]any{
				"title": "Test Bitbucket Repository",
				"type":  string(provisioning.BitbucketRepositoryType),
				"bitbucket": map[string]any{
					"url":    "https://bitbucket.org/workspace/repo.git",
					"branch": "main",
					"path":   "dashboards",
				},
			},
			"secure": map[string]any{
				"token": map[string]any{
					"create": token,
				},
			},
		}}

		created, err := helper.Repositories.Resource.Create(ctx, repository, metav1.CreateOptions{})
		require.NoError(t, err, "failed to create Bitbucket repository")
		require.NotNil(t, created)

		repoName := created.GetName()
		require.NotEmpty(t, repoName, "repository name should not be empty")

		t.Cleanup(func() {
			_ = helper.Repositories.Resource.Delete(ctx, repoName, metav1.DeleteOptions{})
		})

		output, err := helper.Repositories.Resource.Get(ctx, repoName, metav1.GetOptions{})
		require.NoError(t, err, "failed to read back Bitbucket repository")
		assert.Equal(t, repoName, output.GetName(), "name should be equal")

		spec := output.Object["spec"].(map[string]any)
		assert.Equal(t, string(provisioning.BitbucketRepositoryType), spec["type"], "type should be bitbucket")

		restConfig := helper.Org1.Admin.NewRestConfig()
		provClient, err := clientset.NewForConfig(restConfig)
		require.NoError(t, err, "failed to create provisioning client")
		repoClient := provClient.ProvisioningV0alpha1().Repositories("default")

		require.Eventually(t, func() bool {
			updated, err := repoClient.Get(ctx, repoName, metav1.GetOptions{})
			if err != nil {
				return false
			}
			return updated.Status.ObservedGeneration == updated.Generation &&
				updated.Status.Health.Checked > 0
		}, 15*time.Second, 500*time.Millisecond, "repository should be reconciled by controller")

		reconciled, err := repoClient.Get(ctx, repoName, metav1.GetOptions{})
		require.NoError(t, err)

		assert.Equal(t, reconciled.Generation, reconciled.Status.ObservedGeneration,
			"controller should have reconciled the repository")
		assert.Greater(t, reconciled.Status.Health.Checked, int64(0),
			"health check should have been attempted")

		readyCondition := meta.FindStatusCondition(reconciled.Status.Conditions, provisioning.ConditionTypeReady)
		assert.NotNil(t, readyCondition, "should have ready condition")

		t.Logf("Bitbucket repository reconciled successfully. Health: %v, ObservedGen: %d, Checked: %d",
			reconciled.Status.Health.Healthy, reconciled.Status.ObservedGeneration, reconciled.Status.Health.Checked)
	})

	t.Run("All repository types are supported", func(t *testing.T) {
		supportedTypes := []provisioning.RepositoryType{
			provisioning.GitHubRepositoryType,
			provisioning.GitLabRepositoryType,
			provisioning.BitbucketRepositoryType,
			provisioning.GitRepositoryType,
			provisioning.LocalRepositoryType,
			provisioning.GitHubEnterpriseRepositoryType,
		}

		for _, repoType := range supportedTypes {
			t.Run(string(repoType), func(t *testing.T) {
				repo := &unstructured.Unstructured{Object: map[string]any{
					"apiVersion": "provisioning.grafana.app/v0alpha1",
					"kind":       "Repository",
					"metadata": map[string]any{
						"generateName": "test-",
						"namespace":    "default",
					},
					"spec": map[string]any{
						"title": "Test Repository",
						"type":  string(repoType),
					},
				}}

				_, err := helper.Repositories.Resource.Create(ctx, repo, metav1.CreateOptions{})
				if err != nil {
					assert.NotContains(t, err.Error(), "is not supported",
						"type %s should be supported by factory", repoType)
				}
			})
		}
	})
}
