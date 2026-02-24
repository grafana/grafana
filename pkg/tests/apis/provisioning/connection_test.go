package provisioning

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v4"
	"github.com/google/go-github/v82/github"
	githubConnection "github.com/grafana/grafana/apps/provisioning/pkg/connection/github"
	"github.com/grafana/grafana/pkg/extensions"
	"github.com/grafana/grafana/pkg/util/testutil"
	ghmock "github.com/migueleliasweb/go-github-mock/src/mock"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	clientset "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
)

//nolint:gosec // Test RSA private key (generated for testing purposes only)
const testPrivateKeyPEM = `-----BEGIN RSA PRIVATE KEY-----
MIIEoQIBAAKCAQBn1MuM5hIfH6d3TNStI1ofWv/gcjQ4joi9cFijEwVLuPYkF1nD
KkSbaMGFUWiOTaB/H9fxmd/V2u04NlBY3av6m5T/sHfVSiEWAEUblh3cA34HVCmD
cqyyVty5HLGJJlSs2C7W2x7yUc9ImzyDBsyjpKOXuojJ9wN9a17D2cYU5WkXjoDC
4BHid61jn9WBTtPZXSgOdirwahNzxZQSIP7DA9T8yiZwIWPp5YesgsAPyQLCFPgM
s77xz/CEUnEYQ35zI/k/mQrwKdQ/ZP8xLwQohUID0BIxE7G5quL069RuuCZWZkoF
oPiZbp7HSryz1+19jD3rFT7eHGUYvAyCnXmXAgMBAAECggEADSs4Bc7ITZo+Kytb
bfol3AQ2n8jcRrANN7mgBE7NRSVYUouDnvUlbnCC2t3QXPwLdxQa11GkygLSQ2bg
GeVDgq1o4GUJTcvxFlFCcpU/hEANI/DQsxNAQ/4wUGoLOlHaO3HPvwBblHA70gGe
Ux/xpG+lMAFAiB0EHEwZ4M0mClBEOQv3NzaFTWuBHtIMS8eid7M1q5qz9+rCgZSL
KBBHo0OvUbajG4CWl8SM6LUYapASGg+U17E+4xA3npwpIdsk+CbtX+vvX324n4kn
0EkrJqCjv8M1KiCKAP+UxwP00ywxOg4PN+x+dHI/I7xBvEKe/x6BltVSdGA+PlUK
02wagQKBgQDF7gdQLFIagPH7X7dBP6qEGxj/Ck9Qdz3S1gotPkVeq+1/UtQijYZ1
j44up/0yB2B9P4kW091n+iWcyfoU5UwBua9dHvCZP3QH05LR1ZscUHxLGjDPBASt
l2xSq0hqqNWBspb1M0eCY0Yxi65iDkj3xsI2iN35BEb1FlWdR5KGvwKBgQCGS0ce
wASWbZIPU2UoKGOQkIJU6QmLy0KZbfYkpyfE8IxGttYVEQ8puNvDDNZWHNf+LP85
c8iV6SfnWiLmu1XkG2YmJFBCCAWgJ8Mq2XQD8E+a/xcaW3NqlcC5+I2czX367j3r
69wZSxRbzR+DCfOiIkrekJImwN183ZYy2cBbKQKBgFj86IrSMmO6H5Ft+j06u5ZD
fJyF7Rz3T3NwSgkHWzbyQ4ggHEIgsRg/36P4YSzSBj6phyAdRwkNfUWdxXMJmH+a
FU7frzqnPaqbJAJ1cBRt10QI1XLtkpDdaJVObvONTtjOC3LYiEkGCzQRYeiyFXpZ
AU51gJ8JnkFotjtNR4KPAoGAehVREDlLcl0lnN0ZZspgyPk2Im6/iOA9KTH3xBZZ
ZwWu4FIyiHA7spgk4Ep5R0ttZ9oMI3SIcw/EgONGOy8uw/HMiPwWIhEc3B2JpRiO
CU6bb7JalFFyuQBudiHoyxVcY5PVovWF31CLr3DoJr4TR9+Y5H/U/XnzYCIo+w1N
exECgYBFAGKYTIeGAvhIvD5TphLpbCyeVLBIq5hRyrdRY+6Iwqdr5PGvLPKwin5+
+4CDhWPW4spq8MYPCRiMrvRSctKt/7FhVGL2vE/0VY3TcLk14qLC+2+0lnPVgnYn
u5/wOyuHp1cIBnjeN41/pluOWFBHI9xLW3ExLtmYMiecJ8VdRA==
-----END RSA PRIVATE KEY-----`

func TestIntegrationProvisioning_ConnectionCRUDL(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafana(t)
	ctx := context.Background()
	privateKeyBase64 := base64.StdEncoding.EncodeToString([]byte(testPrivateKeyPEM))

	t.Run("should perform CRUDL requests on connection", func(t *testing.T) {
		connection := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Connection",
			"metadata": map[string]any{
				"name":      "connection",
				"namespace": "default",
			},
			"spec": map[string]any{
				"title": "Test Connection",
				"type":  provisioning.GitHubRepositoryType,
				"github": map[string]any{
					"appID":          "123456",
					"installationID": "454545",
				},
			},
			"secure": map[string]any{
				"privateKey": map[string]any{
					"create": privateKeyBase64,
				},
			},
		}}
		// CREATE
		c, err := helper.CreateGithubConnection(t, ctx, connection)
		require.NoError(t, err, "failed to create resource")

		connectionName := c.GetName()

		// READ
		output, err := helper.Connections.Resource.Get(ctx, connectionName, metav1.GetOptions{})
		require.NoError(t, err, "failed to read back resource")
		assert.Equal(t, connectionName, output.GetName(), "name should be equal")
		assert.Equal(t, "default", output.GetNamespace(), "namespace should be equal")
		spec := output.Object["spec"].(map[string]any)
		assert.Equal(t, "github", spec["type"], "type should be equal")
		assert.Equal(t, "https://github.com/settings/installations/454545", spec["url"], "url should be equal")
		require.Contains(t, spec, "github")
		githubInfo := spec["github"].(map[string]any)
		assert.Equal(t, "123456", githubInfo["appID"], "appID should be equal")
		assert.Equal(t, "454545", githubInfo["installationID"], "installationID should be equal")
		require.Contains(t, output.Object, "secure", "object should contain secure")
		assert.Contains(t, output.Object["secure"], "privateKey", "secure should contain PrivateKey")

		// LIST
		list, err := helper.Connections.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err, "failed to list resource")
		assert.Equal(t, 1, len(list.Items), "should have one connection")
		assert.Equal(t, connectionName, list.Items[0].GetName(), "name should be equal")

		// UPDATE
		updatedConnection := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Connection",
			"metadata": map[string]any{
				"name":      connectionName,
				"namespace": "default",
			},
			"spec": map[string]any{
				"title": "Test Connection",
				"type":  "github",
				"github": map[string]any{
					"appID":          "123456",
					"installationID": "454546",
				},
			},
			"secure": map[string]any{
				"privateKey": map[string]any{
					"create": privateKeyBase64,
				},
			},
		}}
		res, err := helper.UpdateGithubConnection(t, ctx, updatedConnection)
		require.NoError(t, err, "failed to update resource")
		spec = res.Object["spec"].(map[string]any)
		require.Contains(t, spec, "github")
		githubInfo = spec["github"].(map[string]any)
		assert.Equal(t, "454546", githubInfo["installationID"], "installationID should be updated")

		// DELETE - Retry delete to handle resource version conflicts
		// The controller may have updated the resource after our update, changing the resource version
		require.Eventually(t, func() bool {
			err := helper.Connections.Resource.Delete(ctx, connectionName, metav1.DeleteOptions{})
			if err != nil {
				if k8serrors.IsConflict(err) {
					// Resource version conflict - retry
					return false
				}
				if k8serrors.IsNotFound(err) {
					// Already deleted - success
					return true
				}
				// Other error - fail the test
				require.NoError(t, err, "failed to delete resource")
			}
			return true
		}, 5*time.Second, 100*time.Millisecond, "should successfully delete resource")
		list, err = helper.Connections.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err, "failed to list resources")
		assert.Equal(t, 0, len(list.Items), "should have no connections")
	})

	t.Run("viewer can't create or get connection", func(t *testing.T) {
		connection := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Connection",
			"metadata": map[string]any{
				"name":      "connection",
				"namespace": "default",
			},
			"spec": map[string]any{
				"title": "Test Connection",
				"type":  provisioning.GitHubRepositoryType,
				"github": map[string]any{
					"appID":          "123456",
					"installationID": "454545",
				},
			},
			"secure": map[string]any{
				"privateKey": map[string]any{
					"create": privateKeyBase64,
				},
			},
		}}

		result := helper.ViewerREST.Post().
			Namespace("default").
			Resource("connections").
			Body(connection).
			Do(t.Context())

		require.NotNil(t, result.Error())
		err := &k8serrors.StatusError{}
		require.True(t, errors.As(result.Error(), &err))
		assert.Equal(t, metav1.StatusReasonForbidden, err.Status().Reason)
		assert.Contains(t, err.Status().Message, "User \"viewer\" cannot create resource \"connections\"")
		assert.Contains(t, err.Status().Message, "admin role is required")

		result = helper.ViewerREST.Get().
			Namespace("default").
			Resource("connections").
			Name("connection").
			Do(t.Context())
		require.NotNil(t, result.Error())
		err = &k8serrors.StatusError{}
		require.True(t, errors.As(result.Error(), &err))
		assert.Equal(t, metav1.StatusReasonForbidden, err.Status().Reason)
		assert.Contains(t, err.Status().Message, "User \"viewer\" cannot get resource \"connections\"")
		assert.Contains(t, err.Status().Message, "admin role is required")
	})
}

func TestIntegrationProvisioning_ConnectionMutation(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafana(t)
	ctx := context.Background()
	privateKeyBase64 := base64.StdEncoding.EncodeToString([]byte(testPrivateKeyPEM))

	t.Run("should update connection name with type prefix", func(t *testing.T) {
		connectionType := provisioning.GithubConnectionType
		namePrefix := fmt.Sprintf("%s-", connectionType)

		connection := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Connection",
			"metadata": map[string]any{
				"namespace": "default",
			},
			"spec": map[string]any{
				"title": "Test Connection",
				"type":  connectionType,
				"github": map[string]any{
					"appID":          "123456",
					"installationID": "454545",
				},
			},
			"secure": map[string]any{
				"privateKey": map[string]any{
					"create": privateKeyBase64,
				},
			},
		}}

		c, err := helper.CreateGithubConnection(t, ctx, connection)
		require.NoError(t, err, "failed to create resource")
		require.Contains(t, c.GetName(), namePrefix, "name should be updated")

		t.Cleanup(func() {
			require.EventuallyWithT(t, func(collect *assert.CollectT) {
				err := helper.Connections.Resource.Delete(ctx, c.GetName(), metav1.DeleteOptions{})
				require.NoError(collect, err)
			}, waitTimeoutDefault, waitIntervalDefault)
		})
	})

	t.Run("should update connection name with given prefix", func(t *testing.T) {
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
				"type":  provisioning.GithubConnectionType,
				"github": map[string]any{
					"appID":          "123456",
					"installationID": "454545",
				},
			},
			"secure": map[string]any{
				"privateKey": map[string]any{
					"create": privateKeyBase64,
				},
			},
		}}

		c, err := helper.CreateGithubConnection(t, ctx, connection)
		require.NoError(t, err, "failed to create resource")
		require.Contains(t, c.GetName(), generateName, "name should be updated")

		t.Cleanup(func() {
			require.EventuallyWithT(t, func(collect *assert.CollectT) {
				err := helper.Connections.Resource.Delete(ctx, c.GetName(), metav1.DeleteOptions{})
				require.NoError(collect, err)
			}, waitTimeoutDefault, waitIntervalDefault)
		})
	})

	t.Run("should keep connection name if already given", func(t *testing.T) {
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
				"type":  provisioning.GithubConnectionType,
				"github": map[string]any{
					"appID":          "123456",
					"installationID": "454545",
				},
			},
			"secure": map[string]any{
				"privateKey": map[string]any{
					"create": privateKeyBase64,
				},
			},
		}}

		c, err := helper.CreateGithubConnection(t, ctx, connection)
		require.NoError(t, err, "failed to create resource")
		require.Equal(t, name, c.GetName(), "name should be identical")

		t.Cleanup(func() {
			require.EventuallyWithT(t, func(collect *assert.CollectT) {
				err := helper.Connections.Resource.Delete(ctx, c.GetName(), metav1.DeleteOptions{})
				require.NoError(collect, err)
			}, waitTimeoutDefault, waitIntervalDefault)
		})
	})
}

func TestIntegrationProvisioning_ConnectionEnterpriseMutation(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	if !extensions.IsEnterprise {
		t.Skip("Skipping integration test when not enterprise")
	}

	helper := runGrafana(t)
	ctx := context.Background()

	gitlabNamePrefix := fmt.Sprintf("%s-", provisioning.GitlabConnectionType)
	bitbucketNamePrefix := fmt.Sprintf("%s-", provisioning.BitbucketConnectionType)

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
			}, waitTimeoutDefault, waitIntervalDefault)
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
			}, waitTimeoutDefault, waitIntervalDefault)
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
			}, waitTimeoutDefault, waitIntervalDefault)
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
			}, waitTimeoutDefault, waitIntervalDefault)
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
			}, waitTimeoutDefault, waitIntervalDefault)
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
			}, waitTimeoutDefault, waitIntervalDefault)
		})
	})
}

func TestIntegrationProvisioning_ConnectionValidation(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafana(t)
	createOptions := metav1.CreateOptions{FieldValidation: "Strict"}
	ctx := context.Background()
	privateKeyBase64 := base64.StdEncoding.EncodeToString([]byte(testPrivateKeyPEM))

	t.Run("should fail when type is empty", func(t *testing.T) {
		connection := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Connection",
			"metadata": map[string]any{
				"name":      "connection",
				"namespace": "default",
			},
			"spec": map[string]any{
				"title": "Test Connection",
				"type":  "",
			},
			"secure": map[string]any{
				"privateKey": map[string]any{
					"create": privateKeyBase64,
				},
			},
		}}
		_, err := helper.Connections.Resource.Create(ctx, connection, createOptions)
		require.Error(t, err, "failed to create resource")
		assert.Contains(t, err.Error(), "connection type \"\" is not supported")
	})

	t.Run("should fail when type is invalid", func(t *testing.T) {
		connection := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Connection",
			"metadata": map[string]any{
				"name":      "connection",
				"namespace": "default",
			},
			"spec": map[string]any{
				"title": "Test Connection",
				"type":  "some-invalid-type",
			},
			"secure": map[string]any{
				"privateKey": map[string]any{
					"create": privateKeyBase64,
				},
			},
		}}
		_, err := helper.Connections.Resource.Create(ctx, connection, createOptions)
		require.Error(t, err, "failed to create resource")
		assert.Contains(t, err.Error(), "connection type \"some-invalid-type\" is not supported")
	})

	t.Run("should fail when type is 'git'", func(t *testing.T) {
		connection := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Connection",
			"metadata": map[string]any{
				"name":      "connection",
				"namespace": "default",
			},
			"spec": map[string]any{
				"title": "Test Connection",
				"type":  "git",
			},
			"secure": map[string]any{
				"privateKey": map[string]any{
					"create": privateKeyBase64,
				},
			},
		}}
		_, err := helper.Connections.Resource.Create(ctx, connection, createOptions)
		require.Error(t, err, "failed to create resource")
		assert.Contains(t, err.Error(), "connection type \"git\" is not supported")
	})

	t.Run("should fail when type is 'local'", func(t *testing.T) {
		connection := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Connection",
			"metadata": map[string]any{
				"name":      "connection",
				"namespace": "default",
			},
			"spec": map[string]any{
				"title": "Test Connection",
				"type":  "local",
			},
			"secure": map[string]any{
				"privateKey": map[string]any{
					"create": privateKeyBase64,
				},
			},
		}}
		_, err := helper.Connections.Resource.Create(ctx, connection, createOptions)
		require.Error(t, err, "failed to create resource")
		assert.Contains(t, err.Error(), "connection type \"local\" is not supported")
	})

	t.Run("should fail when type is github but 'github' field is not there", func(t *testing.T) {
		connection := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Connection",
			"metadata": map[string]any{
				"name":      "connection",
				"namespace": "default",
			},
			"spec": map[string]any{
				"title": "Test Connection",
				"type":  "github",
			},
			"secure": map[string]any{
				"privateKey": map[string]any{
					"create": privateKeyBase64,
				},
			},
		}}
		_, err := helper.Connections.Resource.Create(ctx, connection, createOptions)
		require.Error(t, err, "failed to create resource")
		assert.Contains(t, err.Error(), "github info must be specified for GitHub connection")
	})

	t.Run("should fail when type is github but private key is not there", func(t *testing.T) {
		connection := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Connection",
			"metadata": map[string]any{
				"name":      "connection",
				"namespace": "default",
			},
			"spec": map[string]any{
				"title": "Test Connection",
				"type":  "github",
				"github": map[string]any{
					"appID":          "123456",
					"installationID": "454545",
				},
			},
		}}
		_, err := helper.Connections.Resource.Create(ctx, connection, createOptions)
		require.Error(t, err, "failed to create resource")
		assert.Contains(t, err.Error(), "privateKey must be specified for GitHub connection")
	})

	t.Run("should fail when type is github but a client Secret is also specified", func(t *testing.T) {
		connection := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Connection",
			"metadata": map[string]any{
				"name":      "connection",
				"namespace": "default",
			},
			"spec": map[string]any{
				"title": "Test Connection",
				"type":  "github",
				"github": map[string]any{
					"appID":          "123456",
					"installationID": "454545",
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
		assert.Contains(t, err.Error(), "clientSecret is forbidden in GitHub connection")
	})

	t.Run("should fail when type is github and github API is unavailable", func(t *testing.T) {
		connectionFactory := helper.GetEnv().GithubConnectionFactory.(*githubConnection.Factory)
		connectionFactory.Client = ghmock.NewMockedHTTPClient(
			ghmock.WithRequestMatchHandler(
				ghmock.GetApp,
				http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
					w.WriteHeader(http.StatusServiceUnavailable)
					require.NoError(t, json.NewEncoder(w).Encode(github.ErrorResponse{
						Response: &http.Response{
							StatusCode: http.StatusServiceUnavailable,
						},
						Message: "Service unavailable",
					}))
				}),
			),
		)
		helper.SetGithubConnectionFactory(connectionFactory)

		connection := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Connection",
			"metadata": map[string]any{
				"name":      "connection",
				"namespace": "default",
			},
			"spec": map[string]any{
				"title": "Test Connection",
				"type":  "github",
				"github": map[string]any{
					"appID":          "123456",
					"installationID": "454545",
				},
			},
			"secure": map[string]any{
				"privateKey": map[string]any{
					"create": privateKeyBase64,
				},
			},
		}}
		// CREATE should succeed - runtime validation happens in controller
		created, err := helper.Connections.Resource.Create(ctx, connection, createOptions)
		require.NoError(t, err, "CREATE should succeed")
		require.NotNil(t, created)

		connName := created.GetName()
		t.Cleanup(func() {
			_ = helper.Connections.Resource.Delete(ctx, connName, metav1.DeleteOptions{})
		})

		// Wait for controller to process and mark connection as unhealthy
		restConfig := helper.Org1.Admin.NewRestConfig()
		provisioningClient, err := clientset.NewForConfig(restConfig)
		require.NoError(t, err)
		connClient := provisioningClient.ProvisioningV0alpha1().Connections("default")

		require.Eventually(t, func() bool {
			conn, err := connClient.Get(ctx, connName, metav1.GetOptions{})
			if err != nil {
				return false
			}
			// Connection should be unhealthy with error message about API being unavailable
			return !conn.Status.Health.Healthy &&
				conn.Status.Health.Checked > 0 &&
				len(conn.Status.Health.Message) > 0
		}, 10*time.Second, 500*time.Millisecond, "connection should be marked unhealthy")

		// Verify the error message contains information about API being unavailable
		conn, err := connClient.Get(ctx, connName, metav1.GetOptions{})
		require.NoError(t, err)
		assert.False(t, conn.Status.Health.Healthy, "connection should be unhealthy")
		readyCondition := meta.FindStatusCondition(conn.Status.Conditions, provisioning.ConditionTypeReady)
		require.NotNil(t, readyCondition, "Ready condition should exist")
		assert.Equal(t, metav1.ConditionFalse, readyCondition.Status, "connection should be disconnected")
		// Check that error message mentions API unavailable
		hasUnavailableError := false
		for _, msg := range conn.Status.Health.Message {
			if strings.Contains(msg, "unavailable") || strings.Contains(msg, "Service unavailable") {
				hasUnavailableError = true
				break
			}
		}
		assert.True(t, hasUnavailableError, "error message should mention API unavailable")
	})

	t.Run("should fail when type is github and returned app ID doesn't match given one", func(t *testing.T) {
		var appID int64 = 123455
		appSlug := "appSlug"
		connectionFactory := helper.GetEnv().GithubConnectionFactory.(*githubConnection.Factory)
		connectionFactory.Client = ghmock.NewMockedHTTPClient(
			ghmock.WithRequestMatchHandler(
				ghmock.GetApp,
				http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					w.WriteHeader(http.StatusOK)
					_, _ = w.Write(ghmock.MustMarshal(github.App{
						ID:   &appID,
						Slug: &appSlug,
					}))
				}),
			),
			ghmock.WithRequestMatchHandler(
				ghmock.PostAppInstallationsAccessTokensByInstallationId,
				http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					w.WriteHeader(http.StatusOK)
					installation := github.InstallationToken{
						Token:     github.Ptr("someToken"),
						ExpiresAt: &github.Timestamp{Time: time.Now().Add(time.Hour * 2)},
					}
					_, _ = w.Write(ghmock.MustMarshal(installation))
				}),
			),
		)
		helper.SetGithubConnectionFactory(connectionFactory)

		connection := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Connection",
			"metadata": map[string]any{
				"name":      "connection",
				"namespace": "default",
			},
			"spec": map[string]any{
				"title": "Test Connection",
				"type":  "github",
				"github": map[string]any{
					"appID":          "123456",
					"installationID": "454545",
				},
			},
			"secure": map[string]any{
				"privateKey": map[string]any{
					"create": privateKeyBase64,
				},
			},
		}}
		// CREATE should succeed - runtime validation happens in controller
		created, err := helper.Connections.Resource.Create(ctx, connection, createOptions)
		require.NoError(t, err, "CREATE should succeed")
		require.NotNil(t, created)

		connName := created.GetName()
		t.Cleanup(func() {
			_ = helper.Connections.Resource.Delete(ctx, connName, metav1.DeleteOptions{})
		})

		// Wait for controller to process and mark connection as unhealthy
		restConfig := helper.Org1.Admin.NewRestConfig()
		provisioningClient, err := clientset.NewForConfig(restConfig)
		require.NoError(t, err)
		connClient := provisioningClient.ProvisioningV0alpha1().Connections("default")

		require.Eventually(t, func() bool {
			conn, err := connClient.Get(ctx, connName, metav1.GetOptions{})
			if err != nil {
				return false
			}
			// Connection should be unhealthy with error message about app ID mismatch
			return !conn.Secure.Token.IsZero() &&
				conn.Generation == conn.Status.ObservedGeneration &&
				!conn.Status.Health.Healthy &&
				conn.Status.Health.Checked > 0 &&
				len(conn.Status.Health.Message) > 0
		}, 10*time.Second, 500*time.Millisecond, "connection should be reconciled and marked unhealthy")

		// Verify the error message contains information about app ID mismatch
		conn, err := connClient.Get(ctx, connName, metav1.GetOptions{})
		require.NoError(t, err)
		assert.False(t, conn.Status.Health.Healthy, "connection should be unhealthy")
		readyCondition := meta.FindStatusCondition(conn.Status.Conditions, provisioning.ConditionTypeReady)
		require.NotNil(t, readyCondition, "Ready condition should exist")
		assert.Equal(t, metav1.ConditionFalse, readyCondition.Status, "connection should be disconnected")
		// Check that error message mentions app ID mismatch
		hasMismatchError := false
		for _, msg := range conn.Status.Health.Message {
			if strings.Contains(msg, "appID mismatch") || strings.Contains(msg, "123456") {
				hasMismatchError = true
				break
			}
		}
		assert.True(t, hasMismatchError, "error message should mention appID mismatch", conn.Status.Health.Message)
		// Verify fieldErrors are populated when connection is unhealthy
		if len(conn.Status.FieldErrors) > 0 {
			// Check that fieldErrors contain relevant error details
			hasFieldError := false
			for _, fieldErr := range conn.Status.FieldErrors {
				if fieldErr.Detail != "" {
					hasFieldError = true
					break
				}
			}
			assert.True(t, hasFieldError, "fieldErrors should contain error details when connection is unhealthy")
		}
	})
}

func TestIntegrationProvisioning_ConnectionEnterpriseValidation(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	if !extensions.IsEnterprise {
		t.Skip("Skipping integration test when not enterprise")
	}

	helper := runGrafana(t)
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
}

func TestIntegrationConnectionController_TokenCreation(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafana(t)
	ctx := context.Background()
	namespace := "default"

	// Create typed client from REST config
	restConfig := helper.Org1.Admin.NewRestConfig()
	provisioningClient, err := clientset.NewForConfig(restConfig)
	require.NoError(t, err)
	connClient := provisioningClient.ProvisioningV0alpha1().Connections(namespace)
	privateKeyBase64 := base64.StdEncoding.EncodeToString([]byte(testPrivateKeyPEM))

	decryptService := helper.GetEnv().DecryptService
	require.NotNil(t, decryptService, "decrypt service not wired properly")

	t.Run("token gets created", func(t *testing.T) {
		// Create a connection using unstructured (like other connection tests)
		connUnstructured := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Connection",
			"metadata": map[string]any{
				"name":      "test-connection-health",
				"namespace": namespace,
			},
			"spec": map[string]any{
				"title": "Test Connection",
				"type":  "github",
				"github": map[string]any{
					"appID":          "12345",
					"installationID": "67890",
				},
			},
			"secure": map[string]any{
				"privateKey": map[string]any{
					"create": privateKeyBase64,
				},
			},
		}}

		createdUnstructured, err := helper.CreateGithubConnection(t, ctx, connUnstructured)
		require.NoError(t, err)
		require.NotNil(t, createdUnstructured)

		connName := createdUnstructured.GetName()

		t.Cleanup(func() {
			_ = helper.Connections.Resource.Delete(ctx, connName, metav1.DeleteOptions{})
		})

		// Wait for initial reconciliation - controller should update status
		require.Eventually(t, func() bool {
			updated, err := connClient.Get(ctx, connName, metav1.GetOptions{})
			if err != nil {
				return false
			}
			readyCondition := meta.FindStatusCondition(updated.Status.Conditions, provisioning.ConditionTypeReady)
			return updated.Status.ObservedGeneration == updated.Generation &&
				updated.Status.Health.Checked > 0 &&
				readyCondition != nil && readyCondition.Status == metav1.ConditionTrue &&
				updated.Status.Health.Healthy
		}, 10*time.Second, 500*time.Millisecond, "connection should be reconciled")

		// Verify initial health check was set
		initial, err := connClient.Get(ctx, connName, metav1.GetOptions{})
		require.NoError(t, err)
		require.NotNil(t, initial)
		require.False(t, initial.Secure.Token.IsZero())

		// Verifying token
		decrypted, err := decryptService.Decrypt(ctx, "provisioning.grafana.app", initial.Namespace, initial.Secure.Token.Name)
		require.NoError(t, err, "decryption error")
		require.Len(t, decrypted, 1)

		val := decrypted[initial.Secure.Token.Name].Value()
		require.NotNil(t, val)
		k := val.DangerouslyExposeAndConsumeValue()
		valid, err := verifyToken(t, "12345", k)
		require.NoError(t, err, "error verifying token: %s", k)
		require.True(t, valid, "token should be valid: %s", k)
	})

	t.Run("token gets updated if appID changes", func(t *testing.T) {
		// Create a connection using unstructured (like other connection tests)
		connUnstructured := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Connection",
			"metadata": map[string]any{
				"name":      "test-connection-health",
				"namespace": namespace,
			},
			"spec": map[string]any{
				"title": "Test Connection",
				"type":  "github",
				"github": map[string]any{
					"appID":          "12345",
					"installationID": "67890",
				},
			},
			"secure": map[string]any{
				"privateKey": map[string]any{
					"create": privateKeyBase64,
				},
			},
		}}

		createdUnstructured, err := helper.CreateGithubConnection(t, ctx, connUnstructured)
		require.NoError(t, err)
		require.NotNil(t, createdUnstructured)

		connName := createdUnstructured.GetName()

		t.Cleanup(func() {
			_ = helper.Connections.Resource.Delete(ctx, connName, metav1.DeleteOptions{})
		})

		// Wait for initial reconciliation - controller should update status
		require.Eventually(t, func() bool {
			updated, err := connClient.Get(ctx, connName, metav1.GetOptions{})
			if err != nil {
				return false
			}
			readyCondition := meta.FindStatusCondition(updated.Status.Conditions, provisioning.ConditionTypeReady)
			return updated.Status.ObservedGeneration == updated.Generation &&
				updated.Status.Health.Checked > 0 &&
				readyCondition != nil && readyCondition.Status == metav1.ConditionTrue &&
				updated.Status.Health.Healthy
		}, 10*time.Second, 500*time.Millisecond, "connection should be reconciled")

		// Verify initial health check was set
		initial, err := connClient.Get(ctx, connName, metav1.GetOptions{})
		require.NoError(t, err)
		require.NotNil(t, initial)
		require.False(t, initial.Secure.Token.IsZero())

		// Verifying token
		decrypted, err := decryptService.Decrypt(ctx, "provisioning.grafana.app", initial.Namespace, initial.Secure.Token.Name)
		require.NoError(t, err, "decryption error")
		require.Len(t, decrypted, 1)

		val := decrypted[initial.Secure.Token.Name].Value()
		require.NotNil(t, val)
		k := val.DangerouslyExposeAndConsumeValue()
		valid, err := verifyToken(t, "12345", k)
		require.NoError(t, err, "error verifying token: %s", k)
		require.True(t, valid, "token should be valid: %s", k)

		// Create a connection using unstructured (like other connection tests)
		updated := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Connection",
			"metadata": map[string]any{
				"name":      connName,
				"namespace": namespace,
			},
			"spec": map[string]any{
				"title": "Test Connection",
				"type":  "github",
				"github": map[string]any{
					"appID":          "54321",
					"installationID": "67890",
				},
			},
			"secure": map[string]any{
				"privateKey": map[string]any{
					"create": privateKeyBase64,
				},
			},
		}}

		updatedUnstructured, err := helper.UpdateGithubConnection(t, ctx, updated)
		require.NoError(t, err)
		require.NotNil(t, updatedUnstructured)

		// Wait for initial reconciliation - controller should update status
		require.Eventually(t, func() bool {
			updated, err := connClient.Get(ctx, connName, metav1.GetOptions{})
			if err != nil {
				return false
			}
			readyCondition := meta.FindStatusCondition(updated.Status.Conditions, provisioning.ConditionTypeReady)
			return updated.Status.ObservedGeneration == updated.Generation &&
				updated.Status.Health.Checked > 0 &&
				readyCondition != nil && readyCondition.Status == metav1.ConditionTrue &&
				updated.Status.Health.Healthy
		}, 10*time.Second, 500*time.Millisecond, "connection should be reconciled again")

		c, err := connClient.Get(ctx, connName, metav1.GetOptions{})
		require.NoError(t, err)
		require.NotNil(t, c)
		// Verify secret got updated
		require.NotEqual(t, c.Secure.Token.Name, initial.Secure.Token.Name)

		// Verifying token
		newSecretDecrypted, err := decryptService.Decrypt(ctx, "provisioning.grafana.app", c.Namespace, c.Secure.Token.Name)
		require.NoError(t, err, "decryption error")
		require.Len(t, decrypted, 1)

		newVal := newSecretDecrypted[c.Secure.Token.Name].Value()
		require.NotNil(t, newVal)
		newK := newVal.DangerouslyExposeAndConsumeValue()
		require.NotEqual(t, k, newK)
		valid, err = verifyToken(t, "54321", newK)
		require.NoError(t, err, "error verifying token: %s", newK)
		require.True(t, valid, "token should be valid: %s", newK)
	})
}

func TestIntegrationConnectionController_HealthCheckUpdates(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafana(t)
	ctx := context.Background()
	namespace := "default"

	// Create typed client from REST config
	restConfig := helper.Org1.Admin.NewRestConfig()
	provisioningClient, err := clientset.NewForConfig(restConfig)
	require.NoError(t, err)
	connClient := provisioningClient.ProvisioningV0alpha1().Connections(namespace)
	privateKeyBase64 := base64.StdEncoding.EncodeToString([]byte(testPrivateKeyPEM))

	t.Run("health check gets updated after initial creation", func(t *testing.T) {
		// Create a connection using unstructured (like other connection tests)
		connUnstructured := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Connection",
			"metadata": map[string]any{
				"name":      "test-connection-health",
				"namespace": namespace,
			},
			"spec": map[string]any{
				"title": "Test Connection",
				"type":  "github",
				"github": map[string]any{
					"appID":          "12345",
					"installationID": "67890",
				},
			},
			"secure": map[string]any{
				"privateKey": map[string]any{
					"create": privateKeyBase64,
				},
			},
		}}

		createdUnstructured, err := helper.CreateGithubConnection(t, ctx, connUnstructured)
		require.NoError(t, err)
		require.NotNil(t, createdUnstructured)

		connName := createdUnstructured.GetName()

		t.Cleanup(func() {
			_ = helper.Connections.Resource.Delete(ctx, connName, metav1.DeleteOptions{})
		})

		// Wait for initial reconciliation - controller should update status
		require.Eventually(t, func() bool {
			updated, err := connClient.Get(ctx, connName, metav1.GetOptions{})
			if err != nil {
				return false
			}
			readyCondition := meta.FindStatusCondition(updated.Status.Conditions, provisioning.ConditionTypeReady)
			return updated.Status.ObservedGeneration == updated.Generation &&
				updated.Status.Health.Checked > 0 &&
				readyCondition != nil && readyCondition.Status == metav1.ConditionTrue &&
				updated.Status.Health.Healthy
		}, 10*time.Second, 500*time.Millisecond, "connection should be initially reconciled with health status")

		// Verify initial health check was set
		initial, err := connClient.Get(ctx, connName, metav1.GetOptions{})
		require.NoError(t, err)
		assert.True(t, initial.Status.Health.Healthy, "connection should be healthy")
		readyCondition := meta.FindStatusCondition(initial.Status.Conditions, provisioning.ConditionTypeReady)
		require.NotNil(t, readyCondition, "Ready condition should exist")
		assert.Equal(t, metav1.ConditionTrue, readyCondition.Status, "connection should be connected")
		assert.Greater(t, initial.Status.Health.Checked, int64(0), "health check timestamp should be set")
		assert.Equal(t, initial.Generation, initial.Status.ObservedGeneration, "observed generation should match")
		// When healthy, fieldErrors should be empty
		assert.Empty(t, initial.Status.FieldErrors, "fieldErrors should be empty when connection is healthy")
		// Verify Ready condition is set
		assert.NotEmpty(t, initial.Status.Conditions, "conditions should be set")
		assert.NotNil(t, readyCondition, "Ready condition should exist")
		assert.Equal(t, metav1.ConditionTrue, readyCondition.Status, "Ready condition should be True")
		assert.Equal(t, provisioning.ReasonAvailable, readyCondition.Reason, "Ready condition should have Available reason")
	})

	t.Run("health check updates when spec changes", func(t *testing.T) {
		// Create a connection using unstructured
		connUnstructured := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Connection",
			"metadata": map[string]any{
				"name":      "test-connection-spec-change",
				"namespace": namespace,
			},
			"spec": map[string]any{
				"title": "Test Connection",
				"type":  "github",
				"github": map[string]any{
					"appID":          "11111",
					"installationID": "22222",
				},
			},
			"secure": map[string]any{
				"privateKey": map[string]any{
					"create": privateKeyBase64,
				},
			},
		}}

		createdUnstructured, err := helper.CreateGithubConnection(t, ctx, connUnstructured)
		require.NoError(t, err)
		require.NotNil(t, createdUnstructured)

		connName := createdUnstructured.GetName()

		t.Cleanup(func() {
			_ = helper.Connections.Resource.Delete(ctx, connName, metav1.DeleteOptions{})
		})

		// Wait for initial reconciliation
		var initialHealthChecked int64
		require.Eventually(t, func() bool {
			updated, err := connClient.Get(ctx, connName, metav1.GetOptions{})
			if err != nil {
				return false
			}
			if updated.Status.ObservedGeneration == updated.Generation {
				initialHealthChecked = updated.Status.Health.Checked
				return true
			}
			return false
		}, 10*time.Second, 500*time.Millisecond, "connection should be initially reconciled")

		// Get the latest version before updating to avoid conflicts with controller updates
		latestUnstructured, err := helper.Connections.Resource.Get(ctx, connName, metav1.GetOptions{})
		require.NoError(t, err)

		// Forcing the update of healthcheck - marking it as old.
		health := latestUnstructured.Object["status"].(map[string]any)["health"].(map[string]any)
		health["checked"] = time.UnixMilli(initialHealthChecked).Add(-5 * time.Minute).UnixMilli()
		updated, err := helper.Connections.Resource.UpdateStatus(ctx, latestUnstructured, metav1.UpdateOptions{})
		require.NoError(t, err)

		// Update the connection spec using the latest version
		updatedUnstructured := updated.DeepCopy()
		githubSpec := updatedUnstructured.Object["spec"].(map[string]any)["github"].(map[string]any)
		githubSpec["appID"] = "99999"
		_, err = helper.UpdateGithubConnection(t, ctx, updatedUnstructured)
		require.NoError(t, err)

		// Wait for reconciliation after spec change
		require.Eventually(t, func() bool {
			reconciled, err := connClient.Get(ctx, connName, metav1.GetOptions{})
			if err != nil {
				return false
			}
			return reconciled.Status.ObservedGeneration == reconciled.Generation &&
				reconciled.Status.Health.Checked > initialHealthChecked
		}, 10*time.Second, 500*time.Millisecond, "connection should be reconciled after spec change")

		// Verify health check was updated
		final, err := connClient.Get(ctx, connName, metav1.GetOptions{})
		require.NoError(t, err)
		assert.Equal(t, final.Generation, final.Status.ObservedGeneration, "observed generation should match generation")
		assert.Greater(t, final.Status.Health.Checked, initialHealthChecked, "health check should be updated after spec change")
		assert.True(t, final.Status.Health.Healthy, "connection should remain healthy")
		// When healthy after spec change, fieldErrors should be empty
		assert.Empty(t, final.Status.FieldErrors, "fieldErrors should be empty when connection is healthy after spec change")
		// Verify Ready condition is still set correctly
		assert.NotEmpty(t, final.Status.Conditions, "conditions should be set")
		readyCondition := meta.FindStatusCondition(final.Status.Conditions, provisioning.ConditionTypeReady)
		assert.NotNil(t, readyCondition, "Ready condition should exist")
		assert.Equal(t, metav1.ConditionTrue, readyCondition.Status, "Ready condition should be True")
		assert.Equal(t, provisioning.ReasonAvailable, readyCondition.Reason, "Ready condition should have Available reason")
	})
}

func TestIntegrationConnectionController_UnhealthyWithValidationErrors(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafana(t)
	ctx := context.Background()
	namespace := "default"

	// Create typed client from REST config
	restConfig := helper.Org1.Admin.NewRestConfig()
	provisioningClient, err := clientset.NewForConfig(restConfig)
	require.NoError(t, err)
	connClient := provisioningClient.ProvisioningV0alpha1().Connections(namespace)
	privateKeyBase64 := base64.StdEncoding.EncodeToString([]byte(testPrivateKeyPEM))

	t.Run("connection with invalid installation ID becomes unhealthy with fieldErrors", func(t *testing.T) {
		// Create a connection first with valid credentials
		connUnstructured := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Connection",
			"metadata": map[string]any{
				"name":      "test-connection-invalid-installation",
				"namespace": namespace,
			},
			"spec": map[string]any{
				"title": "Test Connection",
				"type":  "github",
				"github": map[string]any{
					"appID":          "123456",
					"installationID": "999999999", // Invalid installation ID that doesn't exist
				},
			},
			"secure": map[string]any{
				"privateKey": map[string]any{
					"create": privateKeyBase64,
				},
			},
		}}

		createdUnstructured, err := helper.CreateGithubConnection(t, ctx, connUnstructured)
		require.NoError(t, err)
		require.NotNil(t, createdUnstructured)

		// Now set up a mock that will fail for this installation ID
		var appID int64 = 123456
		appSlug := "appSlug"
		connectionFactory := helper.GetEnv().GithubConnectionFactory.(*githubConnection.Factory)
		connectionFactory.Client = ghmock.NewMockedHTTPClient(
			ghmock.WithRequestMatchHandler(
				ghmock.GetApp,
				http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					w.WriteHeader(http.StatusOK)
					_, _ = w.Write(ghmock.MustMarshal(github.App{
						ID:   &appID,
						Slug: &appSlug,
						Permissions: &github.InstallationPermissions{
							Contents:        github.Ptr("write"),
							Metadata:        github.Ptr("read"),
							PullRequests:    github.Ptr("write"),
							RepositoryHooks: github.Ptr("write"),
						},
					}))
				}),
			),
			ghmock.WithRequestMatchHandler(
				ghmock.GetAppInstallationsByInstallationId,
				http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					// Return 404 Not Found for invalid installation ID
					w.WriteHeader(http.StatusNotFound)
					_, _ = w.Write(ghmock.MustMarshal(github.ErrorResponse{
						Response: &http.Response{
							StatusCode: http.StatusNotFound,
						},
						Message: "installation ID 999999999 not found",
					}))
				}),
			),
		)
		helper.SetGithubConnectionFactory(connectionFactory)

		connName := createdUnstructured.GetName()

		t.Cleanup(func() {
			_ = helper.Connections.Resource.Delete(ctx, connName, metav1.DeleteOptions{})
		})

		// Wait for reconciliation - connection should become unhealthy due to invalid installation ID
		require.Eventually(t, func() bool {
			conn, err := connClient.Get(ctx, connName, metav1.GetOptions{})
			if err != nil {
				return false
			}
			// Connection should be reconciled and marked unhealthy
			return conn.Status.ObservedGeneration == conn.Generation &&
				conn.Status.Health.Checked > 0 &&
				!conn.Status.Health.Healthy
		}, 15*time.Second, 500*time.Millisecond, "connection should be reconciled and marked unhealthy")

		// Verify the connection is unhealthy and has fieldErrors
		conn, err := connClient.Get(ctx, connName, metav1.GetOptions{})
		require.NoError(t, err)
		assert.False(t, conn.Status.Health.Healthy, "connection should be unhealthy")
		readyCondition := meta.FindStatusCondition(conn.Status.Conditions, provisioning.ConditionTypeReady)
		require.NotNil(t, readyCondition, "Ready condition should exist")
		assert.Equal(t, metav1.ConditionFalse, readyCondition.Status, "connection should be disconnected")
		assert.Equal(t, conn.Generation, conn.Status.ObservedGeneration, "connection should be reconciled")
		assert.Greater(t, conn.Status.Health.Checked, int64(0), "health check timestamp should be set")
		// Verify Ready condition reflects unhealthy state
		assert.NotEmpty(t, conn.Status.Conditions, "conditions should be set")
		assert.NotNil(t, readyCondition, "Ready condition should exist")
		assert.Equal(t, metav1.ConditionFalse, readyCondition.Status, "Ready condition should be False for unhealthy connection")
		assert.Equal(t, provisioning.ReasonInvalidSpec, readyCondition.Reason, "Ready condition should have InvalidConfiguration reason for invalid installation ID")

		// Verify fieldErrors are populated with validation errors - be strict and explicit
		require.Len(t, conn.Status.FieldErrors, 1, "fieldErrors should contain exactly one error for invalid installation ID")

		installationIDError := conn.Status.FieldErrors[0]

		// Verify all fields explicitly
		assert.Equal(t, metav1.CauseTypeFieldValueInvalid, installationIDError.Type, "Type must be FieldValueInvalid")
		assert.Equal(t, "spec.github.installationID", installationIDError.Field, "Field must be spec.installationID")
		assert.Equal(t, "installation not found", installationIDError.Detail, "Detail must match expected error message")
		assert.Equal(t, "999999999", installationIDError.BadValue, "BadValue must be the spec installationID")
		assert.Empty(t, installationIDError.Origin, "Origin should be empty")

		t.Logf("Verified installationID fieldError: Type=%s, Field=%s, Detail=%s, BadValue=%s, Origin=%s",
			installationIDError.Type, installationIDError.Field, installationIDError.Detail, installationIDError.BadValue, installationIDError.Origin)
	})

	t.Run("connection with invalid app ID becomes unhealthy with fieldErrors", func(t *testing.T) {
		// Create a connection first with the app ID that will mismatch
		connUnstructured := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Connection",
			"metadata": map[string]any{
				"name":      "test-connection-invalid-appid",
				"namespace": namespace,
			},
			"spec": map[string]any{
				"title": "Test Connection",
				"type":  "github",
				"github": map[string]any{
					"appID":          "123456", // This will mismatch with the returned app ID
					"installationID": "789012",
				},
			},
			"secure": map[string]any{
				"privateKey": map[string]any{
					"create": privateKeyBase64,
				},
			},
		}}

		createdUnstructured, err := helper.CreateGithubConnection(t, ctx, connUnstructured)
		require.NoError(t, err)
		require.NotNil(t, createdUnstructured)

		// Now set up a mock that returns a different app ID (mismatch)
		var appID int64 = 999999 // Different from the one in spec (123456)
		appSlug := "appSlug"
		var installationID int64 = 789012
		connectionFactory := helper.GetEnv().GithubConnectionFactory.(*githubConnection.Factory)
		connectionFactory.Client = ghmock.NewMockedHTTPClient(
			ghmock.WithRequestMatchHandler(
				ghmock.GetApp,
				http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					w.WriteHeader(http.StatusOK)
					_, _ = w.Write(ghmock.MustMarshal(github.App{
						ID:   &appID,
						Slug: &appSlug,
						Permissions: &github.InstallationPermissions{
							Contents:        github.Ptr("write"),
							Metadata:        github.Ptr("read"),
							PullRequests:    github.Ptr("write"),
							RepositoryHooks: github.Ptr("write"),
						},
					}))
				}),
			),
			ghmock.WithRequestMatchHandler(
				ghmock.GetAppInstallationsByInstallationId,
				http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					w.WriteHeader(http.StatusOK)
					_, _ = w.Write(ghmock.MustMarshal(github.Installation{
						ID: &installationID,
					}))
				}),
			),
		)
		helper.SetGithubConnectionFactory(connectionFactory)

		connName := createdUnstructured.GetName()

		t.Cleanup(func() {
			_ = helper.Connections.Resource.Delete(ctx, connName, metav1.DeleteOptions{})
		})

		// Wait for reconciliation - connection should become unhealthy due to invalid app ID
		require.Eventually(t, func() bool {
			conn, err := connClient.Get(ctx, connName, metav1.GetOptions{})
			if err != nil {
				return false
			}
			// Connection should be reconciled and marked unhealthy
			return conn.Status.ObservedGeneration == conn.Generation &&
				conn.Status.Health.Checked > 0 &&
				!conn.Status.Health.Healthy
		}, 15*time.Second, 500*time.Millisecond, "connection should be reconciled and marked unhealthy")

		// Verify the connection is unhealthy and has fieldErrors
		conn, err := connClient.Get(ctx, connName, metav1.GetOptions{})
		require.NoError(t, err)
		assert.False(t, conn.Status.Health.Healthy, "connection should be unhealthy")
		readyCondition := meta.FindStatusCondition(conn.Status.Conditions, provisioning.ConditionTypeReady)
		require.NotNil(t, readyCondition, "Ready condition should exist")
		assert.Equal(t, metav1.ConditionFalse, readyCondition.Status, "connection should be disconnected")
		assert.Equal(t, conn.Generation, conn.Status.ObservedGeneration, "connection should be reconciled")
		assert.Greater(t, conn.Status.Health.Checked, int64(0), "health check timestamp should be set")
		// Verify Ready condition reflects unhealthy state
		assert.NotEmpty(t, conn.Status.Conditions, "conditions should be set")
		assert.NotNil(t, readyCondition, "Ready condition should exist")
		assert.Equal(t, metav1.ConditionFalse, readyCondition.Status, "Ready condition should be False for unhealthy connection")
		assert.Equal(t, provisioning.ReasonInvalidSpec, readyCondition.Reason, "Ready condition should have InvalidConfiguration reason for app ID mismatch")

		// Verify fieldErrors are populated with validation errors - be strict and explicit
		require.Len(t, conn.Status.FieldErrors, 1, "fieldErrors should contain exactly one error for app ID mismatch")

		appIDError := conn.Status.FieldErrors[0]

		// Verify all fields explicitly
		assert.Equal(t, metav1.CauseTypeFieldValueInvalid, appIDError.Type, "Type must be FieldValueInvalid")
		assert.Equal(t, "spec.github.appID", appIDError.Field, "Field must be spec.appID")
		assert.Equal(t, "appID mismatch", appIDError.Detail, "Detail must match expected error message")
		assert.Equal(t, "123456", appIDError.BadValue, "BadValue must be the spec appID")
		assert.Empty(t, appIDError.Origin, "Origin should be empty")

		t.Logf("Verified appID fieldError: Type=%s, Field=%s, Detail=%s, BadValue=%s, Origin=%s",
			appIDError.Type, appIDError.Field, appIDError.Detail, appIDError.BadValue, appIDError.Origin)
	})
}

func TestIntegrationConnectionController_FieldErrorsCleared(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafana(t)
	ctx := context.Background()
	namespace := "default"

	// Create typed client from REST config
	restConfig := helper.Org1.Admin.NewRestConfig()
	provisioningClient, err := clientset.NewForConfig(restConfig)
	require.NoError(t, err)
	connClient := provisioningClient.ProvisioningV0alpha1().Connections(namespace)
	privateKeyBase64 := base64.StdEncoding.EncodeToString([]byte(testPrivateKeyPEM))

	t.Run("connection fieldErrors are cleared when connection becomes healthy", func(t *testing.T) {
		// Create a connection with invalid installation ID that will cause fieldErrors
		connUnstructured := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Connection",
			"metadata": map[string]any{
				"name":      "test-connection-field-errors-cleared",
				"namespace": namespace,
			},
			"spec": map[string]any{
				"title": "Test Connection",
				"type":  "github",
				"github": map[string]any{
					"appID":          "123456",
					"installationID": "999999999", // Invalid installation ID
				},
			},
			"secure": map[string]any{
				"privateKey": map[string]any{
					"create": privateKeyBase64,
				},
			},
		}}

		createdUnstructured, err := helper.CreateGithubConnection(t, ctx, connUnstructured)
		require.NoError(t, err)
		require.NotNil(t, createdUnstructured)

		// Set up a mock that will fail for invalid installation ID
		var appID int64 = 123456
		appSlug := "appSlug"
		connectionFactory := helper.GetEnv().GithubConnectionFactory.(*githubConnection.Factory)
		connectionFactory.Client = ghmock.NewMockedHTTPClient(
			ghmock.WithRequestMatch(
				ghmock.GetApp, github.App{
					ID:   &appID,
					Slug: &appSlug,
					Permissions: &github.InstallationPermissions{
						Contents:        github.Ptr("write"),
						Metadata:        github.Ptr("read"),
						PullRequests:    github.Ptr("write"),
						RepositoryHooks: github.Ptr("write"),
					},
				},
			),
			ghmock.WithRequestMatchHandler(
				ghmock.GetAppInstallationsByInstallationId,
				http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					w.WriteHeader(http.StatusNotFound)
					_, _ = w.Write(ghmock.MustMarshal(github.ErrorResponse{
						Response: &http.Response{
							StatusCode: http.StatusNotFound,
						},
						Message: "installation ID 999999999 not found",
					}))
				}),
			),
		)
		helper.SetGithubConnectionFactory(connectionFactory)

		connName := createdUnstructured.GetName()

		t.Cleanup(func() {
			_ = helper.Connections.Resource.Delete(ctx, connName, metav1.DeleteOptions{})
		})

		// Wait for reconciliation - connection should become unhealthy with fieldErrors
		require.Eventually(t, func() bool {
			conn, err := connClient.Get(ctx, connName, metav1.GetOptions{})
			if err != nil {
				return false
			}
			return conn.Status.ObservedGeneration == conn.Generation &&
				conn.Status.Health.Checked > 0 &&
				!conn.Status.Health.Healthy &&
				len(conn.Status.FieldErrors) > 0
		}, 15*time.Second, 500*time.Millisecond, "connection should be unhealthy with fieldErrors")

		// Verify fieldErrors are present
		connWithErrors, err := connClient.Get(ctx, connName, metav1.GetOptions{})
		require.NoError(t, err)
		require.Greater(t, len(connWithErrors.Status.FieldErrors), 0, "fieldErrors should be present when unhealthy")

		// Fix the connection by updating to a valid installation ID
		latestUnstructured, err := helper.Connections.Resource.Get(ctx, connName, metav1.GetOptions{})
		require.NoError(t, err)

		updatedUnstructured := latestUnstructured.DeepCopy()
		githubSpec := updatedUnstructured.Object["spec"].(map[string]any)["github"].(map[string]any)
		githubSpec["installationID"] = "22222" // Valid installation ID

		// Set up a mock that will succeed for valid installation ID
		var validInstallationID int64 = 22222
		connectionFactory.Client = ghmock.NewMockedHTTPClient(
			ghmock.WithRequestMatch(
				ghmock.GetApp, github.App{
					ID:   &appID,
					Slug: &appSlug,
					Permissions: &github.InstallationPermissions{
						Contents:        github.Ptr("write"),
						Metadata:        github.Ptr("read"),
						PullRequests:    github.Ptr("write"),
						RepositoryHooks: github.Ptr("write"),
					},
				},
			),
			ghmock.WithRequestMatch(
				ghmock.GetAppInstallationsByInstallationId, github.Installation{
					ID: &validInstallationID,
					Permissions: &github.InstallationPermissions{
						Contents:        github.Ptr("write"),
						Metadata:        github.Ptr("read"),
						PullRequests:    github.Ptr("write"),
						RepositoryHooks: github.Ptr("write"),
					},
				},
			),
		)
		helper.SetGithubConnectionFactory(connectionFactory)

		_, err = helper.Connections.Resource.Update(ctx, updatedUnstructured, metav1.UpdateOptions{})
		require.NoError(t, err)

		// Wait for reconciliation - connection should become healthy and fieldErrors should be cleared
		require.Eventually(t, func() bool {
			conn, err := connClient.Get(ctx, connName, metav1.GetOptions{})
			if err != nil {
				return false
			}
			return conn.Status.ObservedGeneration == conn.Generation &&
				conn.Status.Health.Checked > 0 &&
				conn.Status.Health.Healthy &&
				len(conn.Status.FieldErrors) == 0
		}, 15*time.Second, 500*time.Millisecond, "connection should be healthy with fieldErrors cleared")

		// Verify fieldErrors are cleared
		connHealthy, err := connClient.Get(ctx, connName, metav1.GetOptions{})
		require.NoError(t, err)
		assert.True(t, connHealthy.Status.Health.Healthy, "connection should be healthy")
		assert.Empty(t, connHealthy.Status.FieldErrors, "fieldErrors should be cleared when connection becomes healthy")
		// Verify Ready condition is now True
		assert.NotEmpty(t, connHealthy.Status.Conditions, "conditions should be set")
		readyCondition := meta.FindStatusCondition(connHealthy.Status.Conditions, provisioning.ConditionTypeReady)
		assert.NotNil(t, readyCondition, "Ready condition should exist")
		assert.Equal(t, metav1.ConditionTrue, readyCondition.Status, "Ready condition should be True when connection becomes healthy")
		assert.Equal(t, provisioning.ReasonAvailable, readyCondition.Reason, "Ready condition should have Available reason")
	})
}

func TestIntegrationProvisioning_RepositoryFieldSelectorByConnection(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafana(t)
	ctx := context.Background()
	createOptions := metav1.CreateOptions{FieldValidation: "Strict"}
	privateKeyBase64 := base64.StdEncoding.EncodeToString([]byte(testPrivateKeyPEM))

	// Create a connection first
	connection := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "provisioning.grafana.app/v0alpha1",
		"kind":       "Connection",
		"metadata": map[string]any{
			"name":      "test-conn-for-field-selector",
			"namespace": "default",
		},
		"spec": map[string]any{
			"title": "Test Connection",
			"type":  "github",
			"github": map[string]any{
				"appID":          "123456",
				"installationID": "789012",
			},
		},
		"secure": map[string]any{
			"privateKey": map[string]any{
				"create": privateKeyBase64,
			},
		},
	}}

	c, err := helper.CreateGithubConnection(t, ctx, connection)
	require.NoError(t, err, "failed to create connection")

	connectionName := c.GetName()

	t.Cleanup(func() {
		// Clean up repositories first
		_ = helper.Repositories.Resource.Delete(ctx, "repo-with-connection", metav1.DeleteOptions{})
		_ = helper.Repositories.Resource.Delete(ctx, "repo-without-connection", metav1.DeleteOptions{})
		_ = helper.Repositories.Resource.Delete(ctx, "repo-with-different-connection", metav1.DeleteOptions{})
		// Then clean up the connection
		_ = helper.Connections.Resource.Delete(ctx, connectionName, metav1.DeleteOptions{})
	})

	// Create a repository WITH the connection
	repoWithConnection := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "provisioning.grafana.app/v0alpha1",
		"kind":       "Repository",
		"metadata": map[string]any{
			"name":      "repo-with-connection",
			"namespace": "default",
		},
		"spec": map[string]any{
			"title": "Repo With Connection",
			"type":  "local",
			"sync": map[string]any{
				"enabled": false,
				"target":  "folder",
			},
			"local": map[string]any{
				"path": helper.ProvisioningPath,
			},
			"connection": map[string]any{
				"name": connectionName,
			},
		},
	}}

	_, err = helper.Repositories.Resource.Create(ctx, repoWithConnection, createOptions)
	require.NoError(t, err, "failed to create repository with connection")

	// Create a repository WITHOUT the connection
	repoWithoutConnection := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "provisioning.grafana.app/v0alpha1",
		"kind":       "Repository",
		"metadata": map[string]any{
			"name":      "repo-without-connection",
			"namespace": "default",
		},
		"spec": map[string]any{
			"title": "Repo Without Connection",
			"type":  "local",
			"sync": map[string]any{
				"enabled": false,
				"target":  "folder",
			},
			"local": map[string]any{
				"path": helper.ProvisioningPath,
			},
		},
	}}

	_, err = helper.Repositories.Resource.Create(ctx, repoWithoutConnection, createOptions)
	require.NoError(t, err, "failed to create repository without connection")

	// Create a repository with a DIFFERENT connection name (non-existent)
	repoWithDifferentConnection := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "provisioning.grafana.app/v0alpha1",
		"kind":       "Repository",
		"metadata": map[string]any{
			"name":      "repo-with-different-connection",
			"namespace": "default",
		},
		"spec": map[string]any{
			"title": "Repo With Different Connection",
			"type":  "local",
			"sync": map[string]any{
				"enabled": false,
				"target":  "folder",
			},
			"local": map[string]any{
				"path": helper.ProvisioningPath,
			},
			"connection": map[string]any{
				"name": "some-other-connection",
			},
		},
	}}

	_, err = helper.Repositories.Resource.Create(ctx, repoWithDifferentConnection, createOptions)
	require.NoError(t, err, "failed to create repository with different connection")

	t.Run("filter repositories by spec.connection.name", func(t *testing.T) {
		// List repositories with field selector for the specific connection
		list, err := helper.Repositories.Resource.List(ctx, metav1.ListOptions{
			FieldSelector: "spec.connection.name=" + connectionName,
		})
		require.NoError(t, err, "failed to list repositories with field selector")

		// Should only return the repository with the matching connection
		assert.Len(t, list.Items, 1, "should return exactly one repository")
		assert.Equal(t, "repo-with-connection", list.Items[0].GetName(), "should return the correct repository")
	})

	t.Run("filter repositories by non-existent connection returns empty", func(t *testing.T) {
		// List repositories with field selector for a non-existent connection
		list, err := helper.Repositories.Resource.List(ctx, metav1.ListOptions{
			FieldSelector: "spec.connection.name=non-existent-connection",
		})
		require.NoError(t, err, "failed to list repositories with field selector")

		// Should return empty list
		assert.Len(t, list.Items, 0, "should return no repositories for non-existent connection")
	})

	t.Run("filter repositories by empty connection name", func(t *testing.T) {
		// List repositories with field selector for empty connection (repos without connection)
		list, err := helper.Repositories.Resource.List(ctx, metav1.ListOptions{
			FieldSelector: "spec.connection.name=",
		})
		require.NoError(t, err, "failed to list repositories with empty connection field selector")

		// Should return the repository without a connection
		assert.Len(t, list.Items, 1, "should return exactly one repository without connection")
		assert.Equal(t, "repo-without-connection", list.Items[0].GetName(), "should return the repository without connection")
	})

	t.Run("list all repositories without field selector", func(t *testing.T) {
		// List all repositories without field selector
		list, err := helper.Repositories.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err, "failed to list all repositories")

		// Should return all three repositories
		assert.Len(t, list.Items, 3, "should return all three repositories")

		names := make([]string, len(list.Items))
		for i, item := range list.Items {
			names[i] = item.GetName()
		}
		assert.Contains(t, names, "repo-with-connection")
		assert.Contains(t, names, "repo-without-connection")
		assert.Contains(t, names, "repo-with-different-connection")
	})
}

func TestIntegrationProvisioning_ConnectionDeleteBlockedByRepository(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafana(t)
	ctx := context.Background()
	createOptions := metav1.CreateOptions{}
	deleteOptions := metav1.DeleteOptions{}
	privateKeyBase64 := base64.StdEncoding.EncodeToString([]byte(testPrivateKeyPEM))

	// Create a connection
	connection := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "provisioning.grafana.app/v0alpha1",
		"kind":       "Connection",
		"metadata": map[string]any{
			"name":      "test-conn-delete-blocked",
			"namespace": "default",
		},
		"spec": map[string]any{
			"title": "Test Connection",
			"type":  "github",
			"github": map[string]any{
				"appID":          "123456",
				"installationID": "454545",
			},
		},
		"secure": map[string]any{
			"privateKey": map[string]any{
				"create": privateKeyBase64,
			},
		},
	}}

	c, err := helper.Connections.Resource.Create(ctx, connection, createOptions)
	require.NoError(t, err, "failed to create connection")

	connectionName := c.GetName()

	// Create a repository that references the connection
	repo := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "provisioning.grafana.app/v0alpha1",
		"kind":       "Repository",
		"metadata": map[string]any{
			"name":      "repo-referencing-connection",
			"namespace": "default",
		},
		"spec": map[string]any{
			"title": "Repo Referencing Connection",
			"type":  "local",
			"sync": map[string]any{
				"enabled": false,
				"target":  "folder",
			},
			"local": map[string]any{
				"path": helper.ProvisioningPath,
			},
			"connection": map[string]any{
				"name": connectionName,
			},
		},
	}}

	_, err = helper.Repositories.Resource.Create(ctx, repo, createOptions)
	require.NoError(t, err, "failed to create repository referencing connection")

	t.Run("should block connection deletion when referenced by repository", func(t *testing.T) {
		err := helper.Connections.Resource.Delete(ctx, connectionName, deleteOptions)
		require.Error(t, err, "expected deletion to be blocked")

		// Verify it's an Invalid error (containing Forbidden field error)
		assert.True(t, k8serrors.IsInvalid(err), "expected Invalid error, got: %v", err)
		assert.Contains(t, err.Error(), "repo-referencing-connection", "error should mention the referencing repository")
		assert.Contains(t, err.Error(), "cannot delete connection", "error should explain the reason")
	})

	t.Run("should allow connection deletion after repository is deleted", func(t *testing.T) {
		// Delete the repository first
		err := helper.Repositories.Resource.Delete(ctx, "repo-referencing-connection", deleteOptions)
		require.NoError(t, err, "failed to delete repository")

		// Wait for the repository to be fully deleted (might have finalizers)
		require.Eventually(t, func() bool {
			_, err := helper.Repositories.Resource.Get(ctx, "repo-referencing-connection", metav1.GetOptions{})
			return k8serrors.IsNotFound(err)
		}, 30*time.Second, 100*time.Millisecond, "repository should be deleted")

		// Now deletion should succeed
		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			err := helper.Connections.Resource.Delete(ctx, connectionName, deleteOptions)
			require.NoError(collect, err, "failed to delete connection")
		}, 10*time.Second, 100*time.Millisecond, "deletion should succeed")

		// Verify connection is actually deleted
		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			_, err = helper.Connections.Resource.Get(ctx, connectionName, metav1.GetOptions{})
			require.True(collect, k8serrors.IsNotFound(err), "connection should be deleted")
		}, 10*time.Second, 100*time.Millisecond, "connection should be deleted")
	})
}

func TestIntegrationProvisioning_ConnectionDeleteWithNoReferences(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafana(t)
	ctx := context.Background()
	createOptions := metav1.CreateOptions{}
	deleteOptions := metav1.DeleteOptions{}
	privateKeyBase64 := base64.StdEncoding.EncodeToString([]byte(testPrivateKeyPEM))

	// Create a connection with no repository references
	connection := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "provisioning.grafana.app/v0alpha1",
		"kind":       "Connection",
		"metadata": map[string]any{
			"name":      "test-conn-no-refs",
			"namespace": "default",
		},
		"spec": map[string]any{
			"title": "Test Connection",
			"type":  "github",
			"github": map[string]any{
				"appID":          "789012",
				"installationID": "121212",
			},
		},
		"secure": map[string]any{
			"privateKey": map[string]any{
				"create": privateKeyBase64,
			},
		},
	}}

	c, err := helper.Connections.Resource.Create(ctx, connection, createOptions)
	require.NoError(t, err, "failed to create connection")

	connectionName := c.GetName()

	t.Run("should allow deletion of connection with no repository references", func(t *testing.T) {
		err := helper.Connections.Resource.Delete(ctx, connectionName, deleteOptions)
		require.NoError(t, err, "expected deletion to succeed for unreferenced connection")

		// Verify connection is deleted
		_, err = helper.Connections.Resource.Get(ctx, connectionName, metav1.GetOptions{})
		assert.True(t, k8serrors.IsNotFound(err), "connection should be deleted")
	})
}

func TestIntegrationConnectionController_GranularConditionReasons(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafana(t)
	ctx := context.Background()
	namespace := "default"

	// Create typed client from REST config
	restConfig := helper.Org1.Admin.NewRestConfig()
	provisioningClient, err := clientset.NewForConfig(restConfig)
	require.NoError(t, err)
	connClient := provisioningClient.ProvisioningV0alpha1().Connections(namespace)
	privateKeyBase64 := base64.StdEncoding.EncodeToString([]byte(testPrivateKeyPEM))

	t.Run("ServiceUnavailable reason when GitHub API returns 503", func(t *testing.T) {
		// Create a connection
		connUnstructured := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Connection",
			"metadata": map[string]any{
				"name":      "test-connection-service-unavailable",
				"namespace": namespace,
			},
			"spec": map[string]any{
				"title": "Test Connection",
				"type":  "github",
				"github": map[string]any{
					"appID":          "123456",
					"installationID": "789012",
				},
			},
			"secure": map[string]any{
				"privateKey": map[string]any{
					"create": privateKeyBase64,
				},
			},
		}}

		createdUnstructured, err := helper.CreateGithubConnection(t, ctx, connUnstructured)
		require.NoError(t, err)
		require.NotNil(t, createdUnstructured)

		// Set up mock to return 503 Service Unavailable
		connectionFactory := helper.GetEnv().GithubConnectionFactory.(*githubConnection.Factory)
		connectionFactory.Client = ghmock.NewMockedHTTPClient(
			ghmock.WithRequestMatchHandler(
				ghmock.GetApp,
				http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					// Return 503 Service Unavailable
					w.WriteHeader(http.StatusServiceUnavailable)
					_, _ = w.Write(ghmock.MustMarshal(github.ErrorResponse{
						Response: &http.Response{
							StatusCode: http.StatusServiceUnavailable,
						},
						Message: "Service temporarily unavailable",
					}))
				}),
			),
		)
		helper.SetGithubConnectionFactory(connectionFactory)

		connName := createdUnstructured.GetName()

		t.Cleanup(func() {
			_ = helper.Connections.Resource.Delete(ctx, connName, metav1.DeleteOptions{})
		})

		// Wait for reconciliation - connection should become unhealthy with ServiceUnavailable reason
		require.Eventually(t, func() bool {
			conn, err := connClient.Get(ctx, connName, metav1.GetOptions{})
			if err != nil {
				return false
			}
			return conn.Status.ObservedGeneration == conn.Generation &&
				conn.Status.Health.Checked > 0 &&
				!conn.Status.Health.Healthy
		}, 15*time.Second, 500*time.Millisecond, "connection should be reconciled and marked unhealthy")

		// Verify the connection has ServiceUnavailable reason
		conn, err := connClient.Get(ctx, connName, metav1.GetOptions{})
		require.NoError(t, err)
		assert.False(t, conn.Status.Health.Healthy, "connection should be unhealthy")
		readyCondition := meta.FindStatusCondition(conn.Status.Conditions, provisioning.ConditionTypeReady)
		require.NotNil(t, readyCondition, "Ready condition should exist")
		assert.Equal(t, metav1.ConditionFalse, readyCondition.Status, "connection should be disconnected")

		// Verify Ready condition has ServiceUnavailable reason
		assert.NotEmpty(t, conn.Status.Conditions, "conditions should be set")
		require.NotNil(t, readyCondition, "Ready condition should exist")
		assert.Equal(t, metav1.ConditionFalse, readyCondition.Status, "Ready condition should be False")
		assert.Equal(t, provisioning.ReasonServiceUnavailable, readyCondition.Reason, "Ready condition should have ServiceUnavailable reason for 503 errors")
		// Verify message contains the actual error returned by the GitHub client
		assert.Contains(t, readyCondition.Message, "github is unavailable", "condition message should contain the actual error text")
	})
}

func TestIntegrationConnectionController_EnterpriseWiring(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	if !extensions.IsEnterprise {
		t.Skip("Skipping integration test when not enterprise")
	}

	helper := runGrafana(t)
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

		// CREATE
		created, err := helper.Connections.Resource.Create(ctx, connection, metav1.CreateOptions{})
		require.NoError(t, err, "failed to create GitLab connection")
		require.NotNil(t, created)

		connectionName := created.GetName()
		require.NotEmpty(t, connectionName, "connection name should not be empty")

		// Cleanup
		defer func() {
			_ = helper.Connections.Resource.Delete(ctx, connectionName, metav1.DeleteOptions{})
		}()

		// READ
		output, err := helper.Connections.Resource.Get(ctx, connectionName, metav1.GetOptions{})
		require.NoError(t, err, "failed to read back GitLab connection")
		assert.Equal(t, connectionName, output.GetName(), "name should be equal")

		spec := output.Object["spec"].(map[string]any)
		assert.Equal(t, string(provisioning.GitlabConnectionType), spec["type"], "type should be gitlab")

		// Get typed client for status checks
		restConfig := helper.Org1.Admin.NewRestConfig()
		provClient, err := clientset.NewForConfig(restConfig)
		require.NoError(t, err, "failed to create provisioning client")
		connClient := provClient.ProvisioningV0alpha1().Connections("default")

		// Wait for reconciliation - controller should process the resource
		// With fake credentials, health check will fail, but reconciliation should happen
		require.Eventually(t, func() bool {
			updated, err := connClient.Get(ctx, connectionName, metav1.GetOptions{})
			if err != nil {
				return false
			}
			// Check that controller has reconciled (ObservedGeneration matches Generation)
			// and that health check was attempted (Checked > 0)
			return updated.Status.ObservedGeneration == updated.Generation &&
				updated.Status.Health.Checked > 0
		}, 15*time.Second, 500*time.Millisecond, "connection should be reconciled by controller")

		// Verify reconciliation status
		reconciled, err := connClient.Get(ctx, connectionName, metav1.GetOptions{})
		require.NoError(t, err)

		// Controller should have set ObservedGeneration - this proves reconciliation happened
		assert.Equal(t, reconciled.Generation, reconciled.Status.ObservedGeneration,
			"controller should have reconciled the connection")

		// Health check should have been attempted - proves the controller processed it
		assert.Greater(t, reconciled.Status.Health.Checked, int64(0),
			"health check should have been attempted")

		// Should have a ready condition - proves status was updated
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

		// CREATE
		created, err := helper.Connections.Resource.Create(ctx, connection, metav1.CreateOptions{})
		require.NoError(t, err, "failed to create Bitbucket connection")
		require.NotNil(t, created)

		connectionName := created.GetName()
		require.NotEmpty(t, connectionName, "connection name should not be empty")

		// Cleanup
		defer func() {
			_ = helper.Connections.Resource.Delete(ctx, connectionName, metav1.DeleteOptions{})
		}()

		// READ
		output, err := helper.Connections.Resource.Get(ctx, connectionName, metav1.GetOptions{})
		require.NoError(t, err, "failed to read back Bitbucket connection")
		assert.Equal(t, connectionName, output.GetName(), "name should be equal")

		spec := output.Object["spec"].(map[string]any)
		assert.Equal(t, string(provisioning.BitbucketConnectionType), spec["type"], "type should be bitbucket")

		// Get typed client for status checks
		restConfig := helper.Org1.Admin.NewRestConfig()
		provClient, err := clientset.NewForConfig(restConfig)
		require.NoError(t, err, "failed to create provisioning client")
		connClient := provClient.ProvisioningV0alpha1().Connections("default")

		// Wait for reconciliation
		require.Eventually(t, func() bool {
			updated, err := connClient.Get(ctx, connectionName, metav1.GetOptions{})
			if err != nil {
				return false
			}
			return updated.Status.ObservedGeneration == updated.Generation &&
				updated.Status.Health.Checked > 0
		}, 15*time.Second, 500*time.Millisecond, "connection should be reconciled by controller")

		// Verify reconciliation status
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

	t.Run("All connection types are supported", func(t *testing.T) {
		// List all supported connection types by attempting to create connections
		// This validates the factory has all expected types registered

		supportedTypes := []provisioning.ConnectionType{
			provisioning.GithubConnectionType,
			provisioning.GitlabConnectionType,
			provisioning.BitbucketConnectionType,
		}

		for _, connType := range supportedTypes {
			t.Run(string(connType), func(t *testing.T) {
				// We just check that we can create the object without factory errors
				// Validation errors are expected if credentials are missing/invalid
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

				// Try to create - we expect validation error, not "type not supported"
				_, err := helper.Connections.Resource.Create(ctx, conn, metav1.CreateOptions{})
				if err != nil {
					// Should be a validation error, not "type not supported"
					assert.NotContains(t, err.Error(), "is not supported",
						"type %s should be supported by factory", connType)
				}
			})
		}
	})
}

func verifyToken(t *testing.T, appID, token string) (bool, error) {
	t.Helper()

	// Parse the private key
	key, err := jwt.ParseRSAPrivateKeyFromPEM([]byte(testPrivateKeyPEM))
	if err != nil {
		return false, err
	}

	parsedToken, err := jwt.Parse(token, func(token *jwt.Token) (any, error) {
		return &key.PublicKey, nil
	}, jwt.WithValidMethods([]string{jwt.SigningMethodRS256.Alg()}))
	if err != nil {
		return false, err
	}

	claims, ok := parsedToken.Claims.(jwt.MapClaims)
	if !ok || !parsedToken.Valid {
		return false, fmt.Errorf("invalid token")
	}

	return claims.VerifyIssuer(appID, true), nil
}

// createInstallationWithPermissions creates a GitHub installation with specific permissions
func createAppWithPermissions(id int64, permissions map[string]string) *github.App {
	app := &github.App{
		ID:   github.Ptr(id),
		Slug: github.Ptr("test-app"),
		Owner: &github.User{
			Login: github.Ptr("test-owner"),
		},
	}

	// Set permissions based on the map
	if len(permissions) > 0 {
		installationPerms := &github.InstallationPermissions{}

		if contents, ok := permissions["contents"]; ok {
			installationPerms.Contents = github.Ptr(contents)
		}
		if metadata, ok := permissions["metadata"]; ok {
			installationPerms.Metadata = github.Ptr(metadata)
		}
		if prs, ok := permissions["pull_requests"]; ok {
			installationPerms.PullRequests = github.Ptr(prs)
		}
		if hooks, ok := permissions["webhooks"]; ok {
			installationPerms.RepositoryHooks = github.Ptr(hooks)
		}

		app.Permissions = installationPerms
	}

	return app
}

// createInstallationWithPermissions creates a GitHub installation with specific permissions
func createAppInstallationWithPermissions(id int64, permissions map[string]string) *github.Installation {
	installation := &github.Installation{
		ID: github.Ptr(id),
		Permissions: &github.InstallationPermissions{
			Contents:        github.Ptr("write"),
			Metadata:        github.Ptr("read"),
			PullRequests:    github.Ptr("write"),
			RepositoryHooks: github.Ptr("write"),
		},
	}

	// Set permissions based on the map
	if len(permissions) > 0 {
		installationPerms := &github.InstallationPermissions{}

		if contents, ok := permissions["contents"]; ok {
			installationPerms.Contents = github.Ptr(contents)
		}
		if metadata, ok := permissions["metadata"]; ok {
			installationPerms.Metadata = github.Ptr(metadata)
		}
		if prs, ok := permissions["pull_requests"]; ok {
			installationPerms.PullRequests = github.Ptr(prs)
		}
		if hooks, ok := permissions["webhooks"]; ok {
			installationPerms.RepositoryHooks = github.Ptr(hooks)
		}

		installation.Permissions = installationPerms
	}

	return installation
}

func TestIntegrationProvisioning_GithubAppPermissionValidation(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafana(t)
	ctx := context.Background()

	// Base64 encoded test private key
	privateKeyBase64 := base64.StdEncoding.EncodeToString([]byte(testPrivateKeyPEM))

	testCases := []struct {
		name                string
		permissions         map[string]string
		expectHealthy       bool
		expectedErrorCount  int
		expectedErrorFields []string
		expectedErrorDetail string // substring to check in error detail
	}{
		{
			name: "success - all permissions present",
			permissions: map[string]string{
				"contents":      "write",
				"metadata":      "read",
				"pull_requests": "write",
				"webhooks":      "write",
			},
			expectHealthy:      true,
			expectedErrorCount: 0,
		},
		{
			name: "failure - missing contents permission",
			permissions: map[string]string{
				"contents":      "", // missing
				"metadata":      "read",
				"pull_requests": "write",
				"webhooks":      "write",
			},
			expectHealthy:       false,
			expectedErrorCount:  1,
			expectedErrorFields: []string{"spec.github.appID"},
			expectedErrorDetail: "lacks required 'contents' permission",
		},
		{
			name: "failure - insufficient contents permission",
			permissions: map[string]string{
				"contents":      "read", // insufficient
				"metadata":      "read",
				"pull_requests": "write",
				"webhooks":      "write",
			},
			expectHealthy:       false,
			expectedErrorCount:  1,
			expectedErrorFields: []string{"spec.github.appID"},
			expectedErrorDetail: "requires 'write', has 'read'",
		},
		{
			name: "failure - missing metadata permission",
			permissions: map[string]string{
				"contents":      "write",
				"metadata":      "", // missing
				"pull_requests": "write",
				"webhooks":      "write",
			},
			expectHealthy:       false,
			expectedErrorCount:  1,
			expectedErrorFields: []string{"spec.github.appID"},
			expectedErrorDetail: "lacks required 'metadata' permission",
		},
		{
			name: "failure - multiple missing permissions",
			permissions: map[string]string{
				"contents":      "read", // insufficient
				"metadata":      "",     // missing
				"pull_requests": "",     // missing
				"webhooks":      "write",
			},
			expectHealthy:      false,
			expectedErrorCount: 3, // all three failures
		},
		{
			name: "success - write satisfies read requirement",
			permissions: map[string]string{
				"contents":      "write",
				"metadata":      "write", // write satisfies read
				"pull_requests": "write",
				"webhooks":      "write",
			},
			expectHealthy:      true,
			expectedErrorCount: 0,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Setup mock GitHub client
			connectionFactory := helper.GetEnv().GithubConnectionFactory.(*githubConnection.Factory)

			app := createAppWithPermissions(123456, tc.permissions)
			installation := &github.Installation{
				ID: github.Ptr(int64(454545)),
				Permissions: &github.InstallationPermissions{
					Contents:        github.Ptr("write"),
					Metadata:        github.Ptr("read"),
					PullRequests:    github.Ptr("write"),
					RepositoryHooks: github.Ptr("write"),
				},
			}

			connectionFactory.Client = ghmock.NewMockedHTTPClient(
				ghmock.WithRequestMatchHandler(
					ghmock.GetApp,
					http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
						w.WriteHeader(http.StatusOK)
						_, _ = w.Write(ghmock.MustMarshal(app))
					}),
				),
				ghmock.WithRequestMatchHandler(
					ghmock.GetAppInstallationsByInstallationId,
					http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
						w.WriteHeader(http.StatusOK)
						_, _ = w.Write(ghmock.MustMarshal(installation))
					}),
				),
			)
			helper.SetGithubConnectionFactory(connectionFactory)

			// Create connection
			connection := &unstructured.Unstructured{Object: map[string]any{
				"apiVersion": "provisioning.grafana.app/v0alpha1",
				"kind":       "Connection",
				"metadata": map[string]any{
					"name":      fmt.Sprintf("test-conn-%s", strings.ReplaceAll(tc.name, " ", "-")),
					"namespace": "default",
				},
				"spec": map[string]any{
					"title": "Test Connection",
					"type":  "github",
					"github": map[string]any{
						"appID":          "123456",
						"installationID": "454545",
					},
				},
				"secure": map[string]any{
					"privateKey": map[string]any{
						"create": privateKeyBase64,
					},
				},
			}}

			c, err := helper.Connections.Resource.Create(ctx, connection, metav1.CreateOptions{})
			require.NoError(t, err)
			require.NotNil(t, c)
			t.Cleanup(func() {
				require.EventuallyWithT(t, func(collect *assert.CollectT) {
					err := helper.Connections.Resource.Delete(ctx, c.GetName(), metav1.DeleteOptions{})
					require.NoError(collect, err)
				}, waitTimeoutDefault, waitIntervalDefault)
			})

			restConfig := helper.Org1.Admin.NewRestConfig()
			provisioningClient, err := clientset.NewForConfig(restConfig)
			require.NoError(t, err)
			connClient := provisioningClient.ProvisioningV0alpha1().Connections("default")

			// Wait for health check to complete
			var conn *provisioning.Connection
			require.Eventually(t, func() bool {
				var err error
				conn, err = connClient.Get(ctx, c.GetName(), metav1.GetOptions{})
				if err != nil {
					return false
				}
				// Health check should have run
				return conn.Status.ObservedGeneration == conn.Generation &&
					conn.Status.Health.Checked > 0
			}, 15*time.Second, 500*time.Millisecond, "connection should be reconciled and health checked")

			// Validate health status
			if tc.expectHealthy {
				assert.True(t, conn.Status.Health.Healthy, "connection should be healthy with valid permissions")
				assert.Empty(t, conn.Status.FieldErrors, "should have no field errors when healthy")

				readyCondition := meta.FindStatusCondition(conn.Status.Conditions, provisioning.ConditionTypeReady)
				assert.Equal(t, metav1.ConditionTrue, readyCondition.Status, "Ready condition should be True")
			} else {
				assert.False(t, conn.Status.Health.Healthy, "connection should be unhealthy with invalid permissions")
				assert.Len(t, conn.Status.FieldErrors, tc.expectedErrorCount,
					"should have expected number of field errors")

				// Validate error details
				if tc.expectedErrorCount > 0 {
					for _, fieldError := range conn.Status.FieldErrors {
						assert.Equal(t, metav1.CauseTypeForbidden, fieldError.Type,
							"error type should be Forbidden for permission issues")

						if len(tc.expectedErrorFields) > 0 {
							assert.Contains(t, tc.expectedErrorFields, fieldError.Field,
								"error should reference expected field")
						}

						if tc.expectedErrorDetail != "" {
							assert.Contains(t, fieldError.Detail, tc.expectedErrorDetail,
								"error detail should contain expected message")
						}
					}
				}

				readyCondition := meta.FindStatusCondition(conn.Status.Conditions, provisioning.ConditionTypeReady)
				assert.Equal(t, metav1.ConditionFalse, readyCondition.Status, "Ready condition should be False")
				assert.Equal(t, provisioning.ReasonAuthenticationFailed, readyCondition.Reason,
					"Ready condition should have InvalidSpec reason")
			}
		})
	}
}

func TestIntegrationProvisioning_GithubAppInstallationPermissionValidation(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafana(t)
	ctx := context.Background()

	// Base64 encoded test private key
	privateKeyBase64 := base64.StdEncoding.EncodeToString([]byte(testPrivateKeyPEM))

	testCases := []struct {
		name                string
		permissions         map[string]string
		expectHealthy       bool
		expectedErrorCount  int
		expectedErrorFields []string
		expectedErrorDetail string // substring to check in error detail
	}{
		{
			name: "success - all permissions present",
			permissions: map[string]string{
				"contents":      "write",
				"metadata":      "read",
				"pull_requests": "write",
				"webhooks":      "write",
			},
			expectHealthy:      true,
			expectedErrorCount: 0,
		},
		{
			name: "failure - missing contents permission",
			permissions: map[string]string{
				"contents":      "", // missing
				"metadata":      "read",
				"pull_requests": "write",
				"webhooks":      "write",
			},
			expectHealthy:       false,
			expectedErrorCount:  1,
			expectedErrorFields: []string{"spec.github.installationID"},
			expectedErrorDetail: "lacks required 'contents' permission",
		},
		{
			name: "failure - insufficient contents permission",
			permissions: map[string]string{
				"contents":      "read", // insufficient
				"metadata":      "read",
				"pull_requests": "write",
				"webhooks":      "write",
			},
			expectHealthy:       false,
			expectedErrorCount:  1,
			expectedErrorFields: []string{"spec.github.installationID"},
			expectedErrorDetail: "requires 'write', has 'read'",
		},
		{
			name: "failure - missing metadata permission",
			permissions: map[string]string{
				"contents":      "write",
				"metadata":      "", // missing
				"pull_requests": "write",
				"webhooks":      "write",
			},
			expectHealthy:       false,
			expectedErrorCount:  1,
			expectedErrorFields: []string{"spec.github.installationID"},
			expectedErrorDetail: "lacks required 'metadata' permission",
		},
		{
			name: "failure - multiple missing permissions",
			permissions: map[string]string{
				"contents":      "read", // insufficient
				"metadata":      "",     // missing
				"pull_requests": "",     // missing
				"webhooks":      "write",
			},
			expectHealthy:      false,
			expectedErrorCount: 3, // all three failures
		},
		{
			name: "success - write satisfies read requirement",
			permissions: map[string]string{
				"contents":      "write",
				"metadata":      "write", // write satisfies read
				"pull_requests": "write",
				"webhooks":      "write",
			},
			expectHealthy:      true,
			expectedErrorCount: 0,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Setup mock GitHub client
			connectionFactory := helper.GetEnv().GithubConnectionFactory.(*githubConnection.Factory)

			app := &github.App{
				ID:   github.Ptr(int64(123456)),
				Slug: github.Ptr("test-app"),
				Owner: &github.User{
					Login: github.Ptr("test-owner"),
				},
				Permissions: &github.InstallationPermissions{
					Contents:        github.Ptr("write"),
					Metadata:        github.Ptr("read"),
					PullRequests:    github.Ptr("write"),
					RepositoryHooks: github.Ptr("write"),
				},
			}
			installation := createAppInstallationWithPermissions(454545, tc.permissions)

			connectionFactory.Client = ghmock.NewMockedHTTPClient(
				ghmock.WithRequestMatchHandler(
					ghmock.GetApp,
					http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
						w.WriteHeader(http.StatusOK)
						_, _ = w.Write(ghmock.MustMarshal(app))
					}),
				),
				ghmock.WithRequestMatchHandler(
					ghmock.GetAppInstallationsByInstallationId,
					http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
						w.WriteHeader(http.StatusOK)
						_, _ = w.Write(ghmock.MustMarshal(installation))
					}),
				),
			)
			helper.SetGithubConnectionFactory(connectionFactory)

			// Create connection
			connection := &unstructured.Unstructured{Object: map[string]any{
				"apiVersion": "provisioning.grafana.app/v0alpha1",
				"kind":       "Connection",
				"metadata": map[string]any{
					"name":      fmt.Sprintf("test-conn-%s", strings.ReplaceAll(tc.name, " ", "-")),
					"namespace": "default",
				},
				"spec": map[string]any{
					"title": "Test Connection",
					"type":  "github",
					"github": map[string]any{
						"appID":          "123456",
						"installationID": "454545",
					},
				},
				"secure": map[string]any{
					"privateKey": map[string]any{
						"create": privateKeyBase64,
					},
				},
			}}

			c, err := helper.Connections.Resource.Create(ctx, connection, metav1.CreateOptions{})
			require.NoError(t, err)
			require.NotNil(t, c)
			t.Cleanup(func() {
				require.EventuallyWithT(t, func(collect *assert.CollectT) {
					err := helper.Connections.Resource.Delete(ctx, c.GetName(), metav1.DeleteOptions{})
					require.NoError(collect, err)
				}, waitTimeoutDefault, waitIntervalDefault)
			})

			restConfig := helper.Org1.Admin.NewRestConfig()
			provisioningClient, err := clientset.NewForConfig(restConfig)
			require.NoError(t, err)
			connClient := provisioningClient.ProvisioningV0alpha1().Connections("default")

			// Wait for health check to complete
			var conn *provisioning.Connection
			require.Eventually(t, func() bool {
				var err error
				conn, err = connClient.Get(ctx, c.GetName(), metav1.GetOptions{})
				if err != nil {
					return false
				}
				// Health check should have run
				return conn.Status.ObservedGeneration == conn.Generation &&
					conn.Status.Health.Checked > 0
			}, 15*time.Second, 500*time.Millisecond, "connection should be reconciled and health checked")

			// Validate health status
			if tc.expectHealthy {
				assert.True(t, conn.Status.Health.Healthy, "connection should be healthy with valid permissions")
				assert.Empty(t, conn.Status.FieldErrors, "should have no field errors when healthy")

				readyCondition := meta.FindStatusCondition(conn.Status.Conditions, provisioning.ConditionTypeReady)
				assert.Equal(t, metav1.ConditionTrue, readyCondition.Status, "Ready condition should be True")
			} else {
				assert.False(t, conn.Status.Health.Healthy, "connection should be unhealthy with invalid permissions")
				assert.Len(t, conn.Status.FieldErrors, tc.expectedErrorCount,
					"should have expected number of field errors")

				// Validate error details
				if tc.expectedErrorCount > 0 {
					for _, fieldError := range conn.Status.FieldErrors {
						assert.Equal(t, metav1.CauseTypeForbidden, fieldError.Type,
							"error type should be Forbidden for permission issues")

						if len(tc.expectedErrorFields) > 0 {
							assert.Contains(t, tc.expectedErrorFields, fieldError.Field,
								"error should reference expected field")
						}

						if tc.expectedErrorDetail != "" {
							assert.Contains(t, fieldError.Detail, tc.expectedErrorDetail,
								"error detail should contain expected message")
						}
					}
				}

				readyCondition := meta.FindStatusCondition(conn.Status.Conditions, provisioning.ConditionTypeReady)
				assert.Equal(t, metav1.ConditionFalse, readyCondition.Status, "Ready condition should be False")
				assert.Equal(t, provisioning.ReasonAuthenticationFailed, readyCondition.Reason,
					"Ready condition should have InvalidSpec reason")
			}
		})
	}
}
