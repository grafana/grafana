package serviceaccount

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationServiceAccountCallerSpecifiedUID(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction:    false,
		DisableAnonymous:     true,
		APIServerStorageType: "unified",
		UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
			"serviceaccounts.iam.grafana.app": {
				DualWriterMode: rest.Mode0,
			},
		},
		EnableFeatureToggles: []string{
			featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,
			featuremgmt.FlagKubernetesServiceAccountsApi,
		},
	})
	t.Cleanup(helper.Shutdown)

	ctx := context.Background()
	namespace := helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID())
	saClient := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: namespace,
		GVR:       gvrServiceAccounts,
	})

	t.Run("stores a caller-specified uid", func(t *testing.T) {
		const name = "chosenuid1"

		created, err := saClient.Resource.Create(ctx, serviceAccountObject(namespace, name), metav1.CreateOptions{})
		require.NoError(t, err)
		require.Equal(t, name, created.GetName())
		t.Cleanup(func() {
			_ = saClient.Resource.Delete(context.Background(), name, metav1.DeleteOptions{})
		})

		title, _, err := unstructured.NestedString(created.Object, "spec", "title")
		require.NoError(t, err)
		require.Equal(t, "Chosen UID "+name, title)

		fetched, err := saClient.Resource.Get(ctx, name, metav1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, name, fetched.GetName())

		row := serviceAccountUIDRow(t, helper, name)
		require.Equal(t, name, row.UID)
		require.True(t, row.IsServiceAccount)
		require.NotEqual(t, int64(1), row.ID)
	})

	t.Run("rejects a numeric name", func(t *testing.T) {
		for _, name := range []string{"1", "01"} {
			t.Run(name, func(t *testing.T) {
				_, err := saClient.Resource.Create(ctx, serviceAccountObject(namespace, name), metav1.CreateOptions{})
				require.Error(t, err)
				var statusErr *errors.StatusError
				require.ErrorAs(t, err, &statusErr)
				require.Equal(t, int32(400), statusErr.ErrStatus.Code)
				require.Contains(t, statusErr.ErrStatus.Message, "name must not be a number")

				require.False(t, serviceAccountUIDExists(t, helper, name))
			})
		}
	})
}

func serviceAccountObject(namespace, name string) *unstructured.Unstructured {
	return &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "iam.grafana.app/v0alpha1",
		"kind":       "ServiceAccount",
		"metadata": map[string]any{
			"name":      name,
			"namespace": namespace,
		},
		"spec": map[string]any{
			"title": "Chosen UID " + name,
			"role":  "Viewer",
		},
	}}
}

type storedServiceAccountUID struct {
	ID               int64  `xorm:"id"`
	UID              string `xorm:"uid"`
	IsServiceAccount bool   `xorm:"is_service_account"`
}

func serviceAccountUIDRow(t *testing.T, helper *apis.K8sTestHelper, uid string) storedServiceAccountUID {
	t.Helper()
	var row storedServiceAccountUID
	var found bool
	err := helper.GetEnv().SQLStore.WithDbSession(context.Background(), func(sess *db.Session) error {
		var err error
		found, err = sess.Table("user").Where("uid = ?", uid).Get(&row)
		return err
	})
	require.NoError(t, err)
	require.True(t, found)
	return row
}

func serviceAccountUIDExists(t *testing.T, helper *apis.K8sTestHelper, uid string) bool {
	t.Helper()
	var found bool
	err := helper.GetEnv().SQLStore.WithDbSession(context.Background(), func(sess *db.Session) error {
		var err error
		found, err = sess.Table("user").Where("uid = ?", uid).Exist()
		return err
	})
	require.NoError(t, err)
	return found
}
