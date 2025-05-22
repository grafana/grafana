package secret

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"golang.org/x/sync/errgroup"
	"golang.org/x/time/rate"
	"gopkg.in/yaml.v3"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

func TestIntegrationSecureValueCreateManyWithK8s(t *testing.T) {
	//t.Skip("Comment this line to run the test manually. It will spawn a Grafana server with an in-memory SQLite.")

	mustCreateAndProcessSecureValues(context.Background(), t, newK8sRequester(t), 300, 300)
}

func TestIntegrationSecureValueCreateManyWithExtHTTP(t *testing.T) {
	t.Skip("Comment this line to run the test manually. You'll need to have Grafana running externally.")

	requester, err := newExtHttpRequester("http://admin:admin@localhost:3000", 30*time.Second)
	require.NoError(t, err)

	// More than this causes rate limiting or timeouts from the apiserver, so we need to keep it at ~100 req/s.
	// - https://github.com/kubernetes/apiserver/blob/master/pkg/server/config.go#L443
	// - https://github.com/kubernetes/apiserver/blob/master/pkg/endpoints/handlers/create.go#L77-L79
	mustCreateAndProcessSecureValues(context.Background(), t, requester, 1000, 100)
}

// Generic helper function to create and process SecureValues.
func mustCreateAndProcessSecureValues(ctx context.Context, t *testing.T, clientRequester loadRequester, createAmount int, rps float64) {
	g, gctx := errgroup.WithContext(ctx)
	g.SetLimit(createAmount)

	createLimiter := rate.NewLimiter(rate.Limit(rps), int(rps/10))

	secureValues := make([]string, createAmount)

	t1 := time.Now()

	for i := range createAmount {
		g.Go(func() error {
			if err := createLimiter.Wait(gctx); err != nil {
				return fmt.Errorf("rate limiter wait failed: %w", err)
			}

			sv, err := clientRequester.Create(gctx, fmt.Sprintf("%s-%d", t.Name(), i))
			if err != nil {
				return err
			}

			if sv.Status.Phase != secretv0alpha1.SecureValuePhasePending {
				return fmt.Errorf("%s: status.phase is not pending: %v", sv.GetName(), sv.Status.Phase)
			}

			t.Logf("SecureValue %s created with status pending", sv.GetName())

			secureValues[i] = sv.GetName()

			return nil
		})
	}

	require.NoError(t, g.Wait())

	t.Logf("Created %d SecureValues in %s", createAmount, time.Since(t1))

	g, gctx = errgroup.WithContext(ctx)
	g.SetLimit(createAmount / 10)

	readLimiter := rate.NewLimiter(rate.Limit(rps), int(rps))

	t2 := time.Now()

	// Check that each SecureValue was processed by the worker.
	for _, name := range secureValues {
		g.Go(func() error {
			require.NotEmpty(t, name)

			require.Eventually(
				t,
				func() bool {
					// Wait for rate limiter before proceeding with each check
					if err := readLimiter.Wait(gctx); err != nil {
						t.Logf("Rate limiter wait failed: %v", err)
						return false
					}

					sv, err := clientRequester.Read(gctx, name)
					require.NoError(t, err)
					require.NotNil(t, sv)

					if sv.Status.Phase == secretv0alpha1.SecureValuePhaseSucceeded {
						t.Logf("SecureValue %s processed", name)
						return true
					}

					return false
				},
				120*time.Second,
				500*time.Millisecond,
				"expected status.phase to be Succeeded for %s", name,
			)

			return nil
		})
	}

	require.NoError(t, g.Wait())

	t.Logf("Checked %d SecureValues in %s", createAmount, time.Since(t2))

	require.True(t, false)
}

// Different ways to interact with the apiserver.
type loadRequester interface {
	Create(ctx context.Context, name string) (*secretv0alpha1.SecureValue, error)
	Read(ctx context.Context, name string) (*secretv0alpha1.SecureValue, error)
}

// K8s implementation will spawn a Grafana server with the test.
type k8sRequester struct {
	helper *apis.K8sTestHelper
	client *apis.K8sResourceClient
}

var _ loadRequester = (*k8sRequester)(nil)

func newK8sRequester(t *testing.T) *k8sRequester {
	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction: false, // required for experimental APIs
		EnableFeatureToggles: []string{
			// Required to start the example service
			featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,
			featuremgmt.FlagSecretsManagementAppPlatform,
		},
	})

	permissions := map[string]ResourcePermission{
		ResourceSecureValues: {Actions: ActionsAllSecureValues},
		// in order to create securevalues, we need to first create keepers (and delete them to clean it up).
		ResourceKeepers: {
			Actions: []string{
				secret.ActionSecretKeepersCreate,
				secret.ActionSecretKeepersDelete,
			},
		},
	}

	genericUserEditor := mustCreateUsers(t, helper, permissions).Editor

	client := helper.GetResourceClient(apis.ResourceClientArgs{
		User: genericUserEditor,
		GVR:  gvrSecureValues,
	})

	return &k8sRequester{helper, client}
}

func (r *k8sRequester) Create(ctx context.Context, name string) (*secretv0alpha1.SecureValue, error) {
	testSecureValue := r.helper.LoadYAMLOrJSONFile("testdata/secure-value-default-generate.yaml")
	testSecureValue.SetGenerateName("")
	testSecureValue.SetName(name)

	raw, err := r.client.Resource.Create(ctx, testSecureValue, metav1.CreateOptions{})
	if err != nil {
		return nil, fmt.Errorf("%s: %w", raw.GetName(), err)
	}

	secureValue := new(secretv0alpha1.SecureValue)

	err = runtime.DefaultUnstructuredConverter.FromUnstructured(raw.Object, secureValue)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", raw.GetName(), err)
	}

	return secureValue, nil
}

func (r *k8sRequester) Read(ctx context.Context, name string) (*secretv0alpha1.SecureValue, error) {
	raw, err := r.client.Resource.Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("%s: %w", raw.GetName(), err)
	}

	secureValue := new(secretv0alpha1.SecureValue)

	err = runtime.DefaultUnstructuredConverter.FromUnstructured(raw.Object, secureValue)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", raw.GetName(), err)
	}

	return secureValue, nil
}

// Requires that the Grafana instance is running externally and the API is reachable.
type extHttpRequester struct {
	apiURL string
	client *http.Client
}

var _ loadRequester = (*extHttpRequester)(nil)

func newExtHttpRequester(apiURL string, timeout time.Duration) (*extHttpRequester, error) {
	return &extHttpRequester{
		apiURL: apiURL,
		client: &http.Client{
			Timeout: timeout,
		},
	}, nil
}

func (r *extHttpRequester) doRequest(req *http.Request) (*secretv0alpha1.SecureValue, error) {
	req.Header.Set("Content-Type", "application/yaml")
	req.Header.Set("Accept", "application/json")

	resp, err := r.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to create secure value: %w", err)
	}

	defer func() {
		_ = resp.Body.Close()
	}()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode >= http.StatusMultipleChoices {
		return nil, fmt.Errorf("expected status family 2xx, got %d: %v", resp.StatusCode, string(body))
	}

	secureValue := new(secretv0alpha1.SecureValue)
	if err := json.Unmarshal(body, secureValue); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return secureValue, nil
}

func (r *extHttpRequester) Create(ctx context.Context, name string) (*secretv0alpha1.SecureValue, error) {
	uri := fmt.Sprintf("%s/apis/secret.grafana.app/v0alpha1/namespaces/default/securevalues", r.apiURL)

	file, err := os.ReadFile("testdata/secure-value-default-generate.yaml")
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}

	secureValue := new(secretv0alpha1.SecureValue)
	if err := yaml.NewDecoder(bytes.NewBuffer(file)).Decode(secureValue); err != nil {
		return nil, fmt.Errorf("failed to decode file: %w", err)
	}
	secureValue.SetGenerateName("")
	secureValue.SetName(name)

	body, err := yaml.Marshal(secureValue)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal secure value: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, uri, bytes.NewBuffer(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	return r.doRequest(req)
}

func (r *extHttpRequester) Read(ctx context.Context, name string) (*secretv0alpha1.SecureValue, error) {
	uri := fmt.Sprintf("%s/apis/secret.grafana.app/v0alpha1/namespaces/default/securevalues/%s", r.apiURL, name)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, uri, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	return r.doRequest(req)
}
