package apiversion

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

// TestIntegrationPrivateURLRejected checks that the URL validator reaches
// admission in every served version. 10.0.0.1 is private and not allowlisted.
func TestIntegrationPrivateURLRejected(t *testing.T) {
	helper := sharedHelper(t)

	for _, version := range []string{"v0alpha1", "v1beta1"} {
		apiVersion := "provisioning.grafana.app/" + version

		t.Run(version+" repository", func(t *testing.T) {
			_, err := helper.RESTDo("POST", version, "repositories", map[string]interface{}{
				"apiVersion": apiVersion,
				"kind":       "Repository",
				"metadata":   map[string]interface{}{"name": fmt.Sprintf("private-url-repo-%s", version), "namespace": "default"},
				"spec": map[string]interface{}{
					"title":     "Private URL",
					"type":      "git",
					"git":       map[string]interface{}{"url": "https://10.0.0.1/org/repo.git", "branch": "main"},
					"workflows": []string{"write"},
					"sync":      map[string]interface{}{"enabled": false, "target": "folder"},
				},
			})
			require.True(t, apierrors.IsInvalid(err), "expected an invalid error, got %v", err)
			require.ErrorContains(t, err, "must resolve to a public or allowed address")
		})

		t.Run(version+" connection", func(t *testing.T) {
			body := connectionBody(fmt.Sprintf("private-url-conn-%s", version), apiVersion)
			// The GitHub mutator overwrites spec.url, so put the private URL where it survives.
			body["spec"].(map[string]interface{})["githubEnterprise"] = map[string]interface{}{"serverUrl": "https://10.0.0.1"}
			_, err := helper.RESTDo("POST", version, "connections", body)
			require.True(t, apierrors.IsInvalid(err), "expected an invalid error, got %v", err)
			require.ErrorContains(t, err, "must resolve to a public or allowed address")
		})
	}
}
