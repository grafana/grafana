package folder

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationFolderCreateWithHiddenAncestors(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	if !db.IsTestDbSQLite() {
		t.Skip("test only on sqlite for now")
	}

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction:    true,
		DisableAnonymous:     true,
		APIServerStorageType: "unified",
	})
	ctx := context.Background()
	maxDepth := helper.GetEnv().Cfg.MaxNestedFolderDepth
	require.Greater(t, maxDepth, 1)

	makeFolder := func(name, parent string) *unstructured.Unstructured {
		obj := &unstructured.Unstructured{Object: map[string]any{
			"spec": map[string]any{"title": name},
		}}
		obj.SetName(name)
		obj.SetAnnotations(map[string]string{utils.AnnoKeyFolder: parent})
		return obj
	}

	adminClient := helper.GetResourceClient(apis.ResourceClientArgs{User: helper.OrgB.Admin, GVR: gvr})

	parents := make([]string, 0, maxDepth+1)
	parent := ""
	for depth := 0; depth <= maxDepth; depth++ {
		name := fmt.Sprintf("depth-%d", depth)
		created, err := adminClient.Resource.Create(ctx, makeFolder(name, parent), metav1.CreateOptions{})
		require.NoError(t, err)
		parent = created.GetName()
		parents = append(parents, parent)
	}

	for _, tc := range []struct {
		name         string
		parentIndex  int
		wantDepthErr bool
	}{
		{name: "at-limit", parentIndex: maxDepth - 1},
		{name: "over-limit", parentIndex: maxDepth, wantDepthErr: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			parent := parents[tc.parentIndex]
			restricted := helper.CreateUser(tc.name, apis.Org2, org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
				{
					Actions:           []string{"folders:read", "folders:create"},
					Resource:          "folders",
					ResourceAttribute: "uid",
					ResourceID:        parent,
				},
			})
			restrictedClient := helper.GetResourceClient(apis.ResourceClientArgs{User: restricted, GVR: gvr})
			_, err := restrictedClient.Resource.Get(ctx, parent, metav1.GetOptions{})
			require.NoError(t, err, "the immediate parent must be readable")
			for _, ancestor := range parents[:tc.parentIndex] {
				_, err := restrictedClient.Resource.Get(ctx, ancestor, metav1.GetOptions{})
				require.Truef(t, apierrors.IsForbidden(err), "ancestor %s must be unreadable: %v", ancestor, err)
			}

			for _, account := range []struct {
				name   string
				client *apis.K8sResourceClient
			}{
				{name: "admin", client: adminClient},
				{name: "restricted", client: restrictedClient},
			} {
				for _, dryRun := range []bool{true, false} {
					t.Run(fmt.Sprintf("%s/dryRun=%t", account.name, dryRun), func(t *testing.T) {
						name := tc.name + "-" + account.name
						options := metav1.CreateOptions{}
						if dryRun {
							options.DryRun = []string{metav1.DryRunAll}
						}
						_, err := account.client.Resource.Create(ctx, makeFolder(name, parent), options)
						if tc.wantDepthErr {
							var statusErr *apierrors.StatusError
							require.ErrorAs(t, err, &statusErr)
							require.Equal(t, int32(http.StatusBadRequest), statusErr.ErrStatus.Code)
							require.NotNil(t, statusErr.ErrStatus.Details)
							require.Equal(t, "folder.maximum-depth-reached", string(statusErr.ErrStatus.Details.UID))
						} else {
							require.NoError(t, err)
						}

						stored, err := adminClient.Resource.Get(ctx, name, metav1.GetOptions{})
						if dryRun || tc.wantDepthErr {
							require.Truef(t, apierrors.IsNotFound(err), "rejected or dry-run create must not persist: %v", err)
						} else {
							require.NoError(t, err)
							require.Equal(t, parent, stored.GetAnnotations()[utils.AnnoKeyFolder])
						}
					})
				}
			}
		})
	}

	for _, ancestor := range parents {
		_, err := adminClient.Resource.Get(ctx, ancestor, metav1.GetOptions{})
		require.NoError(t, err, "all ancestors must remain present")
	}
}

func TestIntegrationFolderCreateWithHiddenK6Ancestor(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	if !db.IsTestDbSQLite() {
		t.Skip("test only on sqlite for now")
	}

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction:    true,
		DisableAnonymous:     true,
		APIServerStorageType: "unified",
	})
	ctx := context.Background()
	serviceAccountClient := helper.GetResourceClient(apis.ResourceClientArgs{
		ServiceAccountToken: helper.OrgB.AdminServiceAccountToken,
		Namespace:           helper.Namespacer(helper.OrgB.OrgID),
		GVR:                 gvr,
	})
	makeFolder := func(name, parent string) *unstructured.Unstructured {
		obj := &unstructured.Unstructured{Object: map[string]any{
			"spec": map[string]any{"title": name},
		}}
		obj.SetName(name)
		obj.SetAnnotations(map[string]string{utils.AnnoKeyFolder: parent})
		return obj
	}

	parent := ""
	for _, name := range []string{accesscontrol.K6FolderUID, "k6-a", "k6-b"} {
		_, err := serviceAccountClient.Resource.Create(ctx, makeFolder(name, parent), metav1.CreateOptions{})
		require.NoError(t, err)
		parent = name
	}

	restricted := helper.CreateUser("hidden-k6", apis.Org2, org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
		{
			Actions:           []string{"folders:read", "folders:create"},
			Resource:          "folders",
			ResourceAttribute: "uid",
			ResourceID:        parent,
		},
	})
	restrictedClient := helper.GetResourceClient(apis.ResourceClientArgs{User: restricted, GVR: gvr})
	_, err := restrictedClient.Resource.Get(ctx, parent, metav1.GetOptions{})
	require.NoError(t, err, "the immediate parent must be readable")
	for _, ancestor := range []string{accesscontrol.K6FolderUID, "k6-a"} {
		_, err := restrictedClient.Resource.Get(ctx, ancestor, metav1.GetOptions{})
		require.Truef(t, apierrors.IsForbidden(err), "ancestor %s must be unreadable: %v", ancestor, err)
	}

	for _, dryRun := range []bool{true, false} {
		t.Run(fmt.Sprintf("dryRun=%t", dryRun), func(t *testing.T) {
			options := metav1.CreateOptions{}
			if dryRun {
				options.DryRun = []string{metav1.DryRunAll}
			}
			_, err := restrictedClient.Resource.Create(ctx, makeFolder("k6-child", parent), options)
			var statusErr *apierrors.StatusError
			require.ErrorAs(t, err, &statusErr)
			require.Equal(t, int32(http.StatusBadRequest), statusErr.ErrStatus.Code)
			require.NotNil(t, statusErr.ErrStatus.Details)
			require.Equal(t, "folder.cannot-be-created-in-k6", string(statusErr.ErrStatus.Details.UID))

			_, err = serviceAccountClient.Resource.Get(ctx, "k6-child", metav1.GetOptions{})
			require.Truef(t, apierrors.IsNotFound(err), "rejected create must not persist: %v", err)
		})
	}

	_, err = serviceAccountClient.Resource.Create(ctx, makeFolder("k6-child", parent), metav1.CreateOptions{})
	require.NoError(t, err, "the service account must retain its exemption for the same create")
}
