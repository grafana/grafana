package scenarios

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"runtime"
	"strings"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apiserver/apiserver_test/util"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/tools/clientcmd"
)

// APIGroupList represents the /apis discovery response
type APIGroupList struct {
	metav1.TypeMeta `json:",inline"`
	Groups          []metav1.APIGroup `json:"groups"`
}

func TestRuntimeConfig(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping e2e apiserver suite test")
	}

	err := log.SetupConsoleLogger("debug")
	require.NoError(t, err, "could not setup logger")

	_, filename, _, ok := runtime.Caller(0)
	require.Equal(t, true, ok, "runtime caller should be retrievable so we can lookup current dir")

	projectDir := strings.ReplaceAll(filename, "/pkg/services/apiserver/apiserver_test/scenarios/runtime_config_test.go", "")

	tests := []struct {
		name                     string
		runtimeConfig            string
		shouldContainGroups      []string            // API groups that should be present
		shouldContainVersions    [][]string          // Versions for each group that should be present
		shouldNotContainGroups   []string            // API groups that should not be present
		shouldNotContainVersions map[string][]string // For a given group, versions that should not be present
	}{
		{
			name:          "Enabled group works - features.grafana.app",
			runtimeConfig: "features.grafana.app/v0alpha1=true",
			shouldContainGroups: []string{
				"features.grafana.app",
			},
			shouldContainVersions: [][]string{
				{"v0alpha1"},
			},
		},
		{
			name:          "Disabled group works - dashboard.grafana.app",
			runtimeConfig: "dashboard.grafana.app/v1beta1=false,dashboard.grafana.app/v0alpha1=false,dashboard.grafana.app/v2alpha1=false,dashboard.grafana.app/v2beta1=false",
			shouldNotContainGroups: []string{
				"dashboard.grafana.app",
			},
		},
		{
			name:          "Disabling one version doesn't disable others in same group - dashboard.grafana.app",
			runtimeConfig: "dashboard.grafana.app/v0alpha1=false",
			shouldContainGroups: []string{
				"dashboard.grafana.app",
			},
			shouldContainVersions: [][]string{
				{"v1beta1"}, // v1beta1 should still be available
			},
			shouldNotContainVersions: map[string][]string{
				"dashboard.grafana.app": {"v0alpha1"},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			s, err := NewRuntimeConfigScenario(ctx, projectDir, tt.runtimeConfig)
			require.NoError(t, err)
			defer func() {
				_ = s.Close()
			}()

			grafana := s.grafana

			require.NoError(t, s.StartAndWaitReady(grafana))

			// Create HTTP client with TLS skip verify
			httpClient := &http.Client{
				Timeout: 30 * time.Second,
				Transport: &http.Transport{
					TLSClientConfig: &tls.Config{
						InsecureSkipVerify: true,
					},
				},
			}

			// Wait a bit for the API server to be fully ready
			time.Sleep(3 * time.Second)

			token := ensureKubeconfig(t, s)

			// Query the /apis discovery endpoint
			discoveryURL := fmt.Sprintf("https://%s/apis", grafana.DevK8sEndpoint())
			httpCli := util.NewHTTPTestClient(discoveryURL, httpClient, map[string]string{
				"Authorization": fmt.Sprintf("Bearer %s", token),
			})
			resp, err := httpCli.GetRequest(discoveryURL)
			require.NoError(t, err, "failed to query /apis endpoint")
			defer resp.Body.Close()

			require.Equal(t, http.StatusOK, resp.StatusCode, "expected 200 OK from /apis")

			body, err := io.ReadAll(resp.Body)
			require.NoError(t, err, "failed to read response body")

			var apiGroupList APIGroupList
			err = json.Unmarshal(body, &apiGroupList)
			require.NoError(t, err, "failed to unmarshal API group list")

			// Build a map of available groups and their versions
			availableGroups := make(map[string][]string)
			for _, group := range apiGroupList.Groups {
				versions := make([]string, 0, len(group.Versions))
				for _, version := range group.Versions {
					versions = append(versions, version.Version)
				}
				availableGroups[group.Name] = versions
			}

			t.Logf("Available API groups: %+v", availableGroups)

			// Check groups that should be present
			for i, groupName := range tt.shouldContainGroups {
				versions, found := availableGroups[groupName]
				require.True(t, found, "expected API group %s to be present", groupName)

				// Check specific versions if provided
				if len(tt.shouldContainVersions) > i {
					for _, expectedVersion := range tt.shouldContainVersions[i] {
						require.Contains(t, versions, expectedVersion,
							"expected version %s to be present in group %s", expectedVersion, groupName)
					}
				}
			}

			// Check groups that should not be present
			for _, groupName := range tt.shouldNotContainGroups {
				_, found := availableGroups[groupName]
				require.False(t, found, "expected API group %s to NOT be present", groupName)
			}

			// Check specific versions that should not be present
			for groupName, disabledVersions := range tt.shouldNotContainVersions {
				versions, found := availableGroups[groupName]
				if !found {
					// If the entire group is not present, that's fine - versions are also not present
					continue
				}
				for _, disabledVersion := range disabledVersions {
					require.NotContains(t, versions, disabledVersion,
						"expected version %s to NOT be present in group %s", disabledVersion, groupName)
				}
			}
		})
	}
}

func ensureKubeconfig(t *testing.T, s *RuntimeConfigScenario) (token string) {
	// apiregistration group is not accessible to anonymous, use Dev endpoint with loopback config's token
	ctx := context.Background()

	var kubeconfigBytes []byte
	var err error

	// Wait for kubeconfig file to appear on the host filesystem since it's created asynchronously
	kubeconfigPath := s.grafana.GetKubeconfigPath()
	tries := 0
	for tries < 30 {
		tries = tries + 1
		// Get kubeconfig from the host filesystem
		kubeconfigBytes, err = s.grafana.GetKubeconfig(ctx)
		if err == nil {
			break
		}
		t.Logf("Attempt %d: failed to get kubeconfig: %v", tries, err)
		time.Sleep(time.Second)
	}

	require.NoError(t, err, "could not read loopback kubeconfig from %s after %d tries", kubeconfigPath, tries)
	require.NotEmpty(t, kubeconfigBytes, "kubeconfig should not be empty")

	restConfig, err := clientcmd.RESTConfigFromKubeConfig(kubeconfigBytes)
	require.NoError(t, err, "error getting restconfig")
	require.NotEmptyf(t, restConfig.BearerToken, "token should not be empty")

	token = restConfig.BearerToken
	return
}
