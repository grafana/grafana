package provisioning

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v4"
	"github.com/google/go-github/v70/github"
	githubConnection "github.com/grafana/grafana/apps/provisioning/pkg/connection/github"
	"github.com/grafana/grafana/pkg/extensions"
	"github.com/grafana/grafana/pkg/util/testutil"
	ghmock "github.com/migueleliasweb/go-github-mock/src/mock"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
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

//nolint:gosec // Test RSA public key (generated for testing purposes only)
const testPublicKeyPem = `-----BEGIN PUBLIC KEY-----
MIIBITANBgkqhkiG9w0BAQEFAAOCAQ4AMIIBCQKCAQBn1MuM5hIfH6d3TNStI1of
Wv/gcjQ4joi9cFijEwVLuPYkF1nDKkSbaMGFUWiOTaB/H9fxmd/V2u04NlBY3av6
m5T/sHfVSiEWAEUblh3cA34HVCmDcqyyVty5HLGJJlSs2C7W2x7yUc9ImzyDBsyj
pKOXuojJ9wN9a17D2cYU5WkXjoDC4BHid61jn9WBTtPZXSgOdirwahNzxZQSIP7D
A9T8yiZwIWPp5YesgsAPyQLCFPgMs77xz/CEUnEYQ35zI/k/mQrwKdQ/ZP8xLwQo
hUID0BIxE7G5quL069RuuCZWZkoFoPiZbp7HSryz1+19jD3rFT7eHGUYvAyCnXmX
AgMBAAE=
-----END PUBLIC KEY-----`

func TestIntegrationProvisioning_ConnectionCRUDL(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafana(t)
	ctx := context.Background()
	privateKeyBase64 := base64.StdEncoding.EncodeToString([]byte(testPrivateKeyPEM))

	decryptService := helper.GetEnv().DecryptService
	require.NotNil(t, decryptService, "decrypt service not wired properly")

	t.Run("should perform CRUDL requests on connection", func(t *testing.T) {
		connection := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Connection",
			"metadata": map[string]any{
				"name":      "connection",
				"namespace": "default",
			},
			"spec": map[string]any{
				"type": "github",
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
		_, err := helper.CreateGithubConnection(t, ctx, connection)
		require.NoError(t, err, "failed to create resource")

		// READ
		output, err := helper.Connections.Resource.Get(ctx, "connection", metav1.GetOptions{})
		require.NoError(t, err, "failed to read back resource")
		assert.Equal(t, "connection", output.GetName(), "name should be equal")
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

		// Verifying token
		assert.Contains(t, output.Object["secure"], "token", "token should be created")
		secretName, found, err := unstructured.NestedString(output.Object, "secure", "token", "name")
		require.NoError(t, err, "error getting secret name")
		require.True(t, found, "secret name should exist: %v", output.Object)
		decrypted, err := decryptService.Decrypt(ctx, "provisioning.grafana.app", output.GetNamespace(), secretName)
		require.NoError(t, err, "decryption error")
		require.Len(t, decrypted, 1)

		val := decrypted[secretName].Value()
		require.NotNil(t, val)
		k := val.DangerouslyExposeAndConsumeValue()
		valid, err := verifyToken(t, "123456", testPublicKeyPem, k)
		require.NoError(t, err, "error verifying token: %s", k)
		require.True(t, valid, "token should be valid: %s", k)

		// LIST
		list, err := helper.Connections.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err, "failed to list resource")
		assert.Equal(t, 1, len(list.Items), "should have one connection")
		assert.Equal(t, "connection", list.Items[0].GetName(), "name should be equal")

		// UPDATE
		updatedConnection := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Connection",
			"metadata": map[string]any{
				"name":      "connection",
				"namespace": "default",
			},
			"spec": map[string]any{
				"type": "github",
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
			err := helper.Connections.Resource.Delete(ctx, "connection", metav1.DeleteOptions{})
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
				"type": "github",
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
				"type": "",
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
				"type": "some-invalid-type",
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
				"type": "git",
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
				"type": "local",
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
				"type": "github",
			},
			"secure": map[string]any{
				"privateKey": map[string]any{
					"create": privateKeyBase64,
				},
			},
		}}
		_, err := helper.Connections.Resource.Create(ctx, connection, createOptions)
		require.Error(t, err, "failed to create resource")
		assert.Contains(t, err.Error(), "invalid github connection")
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
				"type": "github",
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
				"type": "github",
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
				"type": "github",
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
		_, err := helper.Connections.Resource.Create(ctx, connection, createOptions)
		require.Error(t, err, "failed to create resource")
		assert.Contains(t, err.Error(), "spec.token: Internal error: github is unavailable")
	})

	t.Run("should fail when type is github and returned app ID doesn't match given one", func(t *testing.T) {
		var appID int64 = 123455
		appSlug := "appSlug"
		connectionFactory := helper.GetEnv().GithubConnectionFactory.(*githubConnection.Factory)
		connectionFactory.Client = ghmock.NewMockedHTTPClient(
			ghmock.WithRequestMatch(
				ghmock.GetApp, github.App{
					ID:   &appID,
					Slug: &appSlug,
				},
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
				"type": "github",
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
		_, err := helper.Connections.Resource.Create(ctx, connection, createOptions)
		require.Error(t, err, "failed to create resource")
		assert.Contains(t, err.Error(), "spec.appID: Invalid value: \"123456\": appID mismatch")
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
				"type": "bitbucket",
			},
			"secure": map[string]any{
				"clientSecret": map[string]any{
					"create": "someSecret",
				},
			},
		}}
		_, err := helper.Connections.Resource.Create(ctx, connection, createOptions)
		require.Error(t, err, "failed to create resource")
		assert.Contains(t, err.Error(), "invalid bitbucket connection")
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
				"type": "bitbucket",
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
				"type": "bitbucket",
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
				"type": "gitlab",
			},
			"secure": map[string]any{
				"clientSecret": map[string]any{
					"create": "someSecret",
				},
			},
		}}
		_, err := helper.Connections.Resource.Create(ctx, connection, createOptions)
		require.Error(t, err, "failed to create resource")
		assert.Contains(t, err.Error(), "invalid gitlab connection")
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
				"type": "gitlab",
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
				"type": "gitlab",
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
				"type": "github",
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
			return updated.Status.ObservedGeneration == updated.Generation &&
				updated.Status.Health.Checked > 0 &&
				updated.Status.State == provisioning.ConnectionStateConnected &&
				updated.Status.Health.Healthy
		}, 10*time.Second, 500*time.Millisecond, "connection should be initially reconciled with health status")

		// Verify initial health check was set
		initial, err := connClient.Get(ctx, connName, metav1.GetOptions{})
		require.NoError(t, err)
		assert.True(t, initial.Status.Health.Healthy, "connection should be healthy")
		assert.Equal(t, provisioning.ConnectionStateConnected, initial.Status.State, "connection should be connected")
		assert.Greater(t, initial.Status.Health.Checked, int64(0), "health check timestamp should be set")
		assert.Equal(t, initial.Generation, initial.Status.ObservedGeneration, "observed generation should match")
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
				"type": "github",
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

		// Update the connection spec using the latest version
		updatedUnstructured := latestUnstructured.DeepCopy()
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
			"type": "github",
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

	_, err := helper.CreateGithubConnection(t, ctx, connection)
	require.NoError(t, err, "failed to create connection")

	t.Cleanup(func() {
		// Clean up repositories first
		_ = helper.Repositories.Resource.Delete(ctx, "repo-with-connection", metav1.DeleteOptions{})
		_ = helper.Repositories.Resource.Delete(ctx, "repo-without-connection", metav1.DeleteOptions{})
		_ = helper.Repositories.Resource.Delete(ctx, "repo-with-different-connection", metav1.DeleteOptions{})
		// Then clean up the connection
		_ = helper.Connections.Resource.Delete(ctx, "test-conn-for-field-selector", metav1.DeleteOptions{})
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
				"name": "test-conn-for-field-selector",
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
			FieldSelector: "spec.connection.name=test-conn-for-field-selector",
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

func verifyToken(t *testing.T, appID, publicKey, token string) (bool, error) {
	t.Helper()

	// Parse the private key
	key, err := jwt.ParseRSAPublicKeyFromPEM([]byte(publicKey))
	if err != nil {
		return false, err
	}

	parsedToken, err := jwt.Parse(token, func(token *jwt.Token) (any, error) {
		return key, nil
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
