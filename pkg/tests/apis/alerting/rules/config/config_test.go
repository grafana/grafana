package config

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"

	"github.com/grafana/grafana-app-sdk/resource"

	alertingrulesv0alpha1 "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// configGVR is used by the raw dynamic client below.
var configGVR = schema.GroupVersionResource{
	Group:    alertingrulesv0alpha1.GroupVersion.Group,
	Version:  alertingrulesv0alpha1.GroupVersion.Version,
	Resource: "configs",
}

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

// getTestHelper boots an in-process Grafana for the rules Config resource.
func getTestHelper(t *testing.T) *apis.K8sTestHelper {
	return apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{})
}

func newConfigClient(t *testing.T, user apis.User) *alertingrulesv0alpha1.ConfigClient {
	t.Helper()
	client, err := alertingrulesv0alpha1.NewConfigClientFromGenerator(user.GetClientRegistry())
	require.NoError(t, err)
	return client
}

// rawConfigClient returns a dynamic client for Config in the default
// namespace. Unlike the generated ConfigClient, the dynamic client's Update
// issues a direct PUT without first GETting the object, so it can exercise
// the server-side create-on-update (upsert) path for a not-yet-existing
// singleton.
func rawConfigClient(t *testing.T, user apis.User) dynamic.ResourceInterface {
	t.Helper()
	return user.ResourceClient(t, configGVR).Namespace(apis.DefaultNamespace)
}

// rawUpdate PUTs cfg via the dynamic client (create-on-update capable).
func rawUpdate(t *testing.T, ctx context.Context, user apis.User, cfg *alertingrulesv0alpha1.Config) (*alertingrulesv0alpha1.Config, error) {
	t.Helper()
	obj, err := runtime.DefaultUnstructuredConverter.ToUnstructured(cfg)
	require.NoError(t, err)
	res, err := rawConfigClient(t, user).Update(ctx, &unstructured.Unstructured{Object: obj}, v1.UpdateOptions{})
	if err != nil {
		return nil, err
	}
	out := &alertingrulesv0alpha1.Config{}
	require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(res.Object, out))
	return out, nil
}

// ExternalRulerSync is left unset, which is always valid (clearing/omitting
// is never rejected by the admission validator).
func newConfig(name string) *alertingrulesv0alpha1.Config {
	return &alertingrulesv0alpha1.Config{
		TypeMeta: v1.TypeMeta{
			Kind:       alertingrulesv0alpha1.ConfigKind().Kind(),
			APIVersion: alertingrulesv0alpha1.GroupVersion.Identifier(),
		},
		ObjectMeta: v1.ObjectMeta{
			Namespace: apis.DefaultNamespace,
			Name:      name,
		},
		Spec: alertingrulesv0alpha1.ConfigSpec{},
	}
}

func requireForbidden(t *testing.T, err error, msgContains string) {
	t.Helper()
	require.Error(t, err)
	require.Truef(t, errors.IsForbidden(err), "expected Forbidden (403) but got: %s", err)
	if msgContains != "" {
		require.Contains(t, err.Error(), msgContains)
	}
}

// TestIntegrationConfigCreate verifies that humans cannot bring the singleton
// into existence — it is seeded by the sync worker, and human create is denied
// on every path. A POST is rejected by the authorizer (verb=create); a PUT
// upsert to the missing object is re-authorized by the apiserver as create and
// rejected the same way. Each subtest uses a fresh server so the singleton
// does not yet exist.
func TestIntegrationConfigCreate(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	ctx := context.Background()

	t.Run("POST create is forbidden for humans", func(t *testing.T) {
		helper := getTestHelper(t)
		_, err := newConfigClient(t, helper.Org1.Admin).Create(ctx, newConfig(alertingrulesv0alpha1.ConfigSingletonName), resource.CreateOptions{})
		requireForbidden(t, err, "seeded automatically")
	})

	t.Run("PUT upsert (create-on-update) is forbidden for humans", func(t *testing.T) {
		helper := getTestHelper(t)
		_, err := rawUpdate(t, ctx, helper.Org1.Admin, newConfig(alertingrulesv0alpha1.ConfigSingletonName))
		requireForbidden(t, err, "")
	})
}
