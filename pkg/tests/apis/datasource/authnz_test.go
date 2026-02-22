package datasource

import (
	"context"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationTestDatasourceAuthnz(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("check authz to Datasource instances", func(t *testing.T) {
		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			DisableAnonymous: true,
			EnableFeatureToggles: []string{
				featuremgmt.FlagQueryServiceWithConnections,
			},
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				"datasources.grafana-testdata-datasource.datasource.grafana.app": {
					DualWriterMode: grafanarest.Mode0,
				},
			},
			EnableLog: true,
		})
		adminClient := helper.Org1.Admin.ResourceClient(t, schema.GroupVersionResource{
			Group:    "grafana-testdata-datasource.datasource.grafana.app",
			Version:  "v0alpha1",
			Resource: "datasources",
		}).Namespace("default")
		time.Sleep(time.Second * 10)

		ctx := context.Background()
		dsUID := "test"
		dsUID2 := "test2"
		apiVersion := "grafana-testdata-datasource.datasource.grafana.app/v0alpha1"
		_, err := adminClient.Create(ctx, &unstructured.Unstructured{
			Object: map[string]any{
				"apiVersion": apiVersion,
				"kind":       "DataSource",
				"metadata": map[string]any{
					"name": dsUID,
				},
				"spec": map[string]any{
					"title": "test",
				},
			},
		}, metav1.CreateOptions{})
		require.NoError(t, err)

		_, err = adminClient.Create(ctx, &unstructured.Unstructured{
			Object: map[string]any{
				"apiVersion": apiVersion,
				"kind":       "DataSource",
				"metadata": map[string]any{
					"name": dsUID2,
				},
				"spec": map[string]any{
					"title": "test2",
				},
			},
		}, metav1.CreateOptions{})
		require.NoError(t, err)

		permissions := []resourcepermissions.SetResourcePermissionCommand{
			{
				Actions:           []string{datasources.ActionRead},
				Resource:          "datasources",
				ResourceAttribute: "uid",
				ResourceID:        dsUID,
			},
		}
		login := "user-specific-perms"
		password := "test-pass"
		createUserWithPermissions(t, helper, login, password, permissions)

		legacyUrl := fmt.Sprintf("http://%s:%s@%s/api/datasources/uid/%s", login, password, helper.GetListenerAddress(), dsUID)
		resp, err := http.Get(legacyUrl)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)

		k8sUrl := fmt.Sprintf("http://%s:%s@%s/apis/%s/namespaces/default/datasources/%s", login, password, apiVersion, helper.GetListenerAddress(), dsUID)
		resp, err = http.Get(k8sUrl)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)

		legacyUrl = fmt.Sprintf("http://%s:%s@%s/api/datasources/uid/%s", login, password, helper.GetListenerAddress(), dsUID2)
		resp, err = http.Get(legacyUrl)
		require.NoError(t, err)
		require.Equal(t, http.StatusForbidden, resp.StatusCode)

		k8sUrl = fmt.Sprintf("http://%s:%s@%s/apis/%s/namespaces/default/datasources/%s", login, password, apiVersion, helper.GetListenerAddress(), dsUID2)
		resp, err = http.Get(k8sUrl)
		require.NoError(t, err)
		time.Sleep(time.Second * 3)
		require.Equal(t, http.StatusForbidden, resp.StatusCode)
	})
}

func createUserWithPermissions(
	t *testing.T,
	helper *apis.K8sTestHelper,
	login string,
	password string,
	permissions []resourcepermissions.SetResourcePermissionCommand,
) {
	t.Helper()
	ctx := context.Background()
	testUserId := tests.CreateUser(t, helper.GetEnv().SQLStore, helper.GetEnv().Cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleNone),
		Password:       user.Password(password),
		Login:          login,
		OrgID:          1,
	})

	if len(permissions) > 0 {
		permissionsStore := resourcepermissions.NewStore(helper.GetEnv().Cfg, helper.GetEnv().SQLStore, featuremgmt.WithFeatures())
		for _, cmd := range permissions {
			_, err := permissionsStore.SetUserResourcePermission(
				ctx,
				1,
				accesscontrol.User{ID: testUserId},
				cmd,
				nil,
			)
			require.NoError(t, err)
		}
	}

	// Reload permission cache
	cacheURL := fmt.Sprintf("http://%s:%s@%s/api/access-control/user/permissions?reloadcache=true",
		login, password, helper.GetListenerAddress())
	cacheResp, err := http.Get(cacheURL)
	require.NoError(t, err)
	cacheResp.Body.Close()
}
