package folders

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"testing"
	"testing/synctest"
	"time"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	dynamicfake "k8s.io/client-go/dynamic/fake"
	k8stesting "k8s.io/client-go/testing"

	"github.com/grafana/grafana-app-sdk/logging"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	foldersv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/registry/apis/iam/resourcepermission/rpclient"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

var prefsGVR = dashv2beta1.DashboardPreferencesResourceInfo.GroupVersionResource()

func newDashboardPreferencesFake() *dynamicfake.FakeDynamicClient {
	return dynamicfake.NewSimpleDynamicClientWithCustomListKinds(runtime.NewScheme(),
		map[schema.GroupVersionResource]string{prefsGVR: "DashboardPreferencesList"})
}

// seedDashboardPreferences creates the tiers through the client so they are stored under the
// dashboardpreferences resource; the fake's constructor would guess a different resource name.
func seedDashboardPreferences(t *testing.T, dyn *dynamicfake.FakeDynamicClient, namespace string, names ...string) {
	t.Helper()
	for _, name := range names {
		_, err := dyn.Resource(prefsGVR).Namespace(namespace).Create(context.Background(), unstructuredDashboardPreferences(namespace, name), metav1.CreateOptions{})
		require.NoError(t, err)
	}
	dyn.ClearActions()
}

func unstructuredDashboardPreferences(namespace, name string) *unstructured.Unstructured {
	u := &unstructured.Unstructured{}
	u.SetGroupVersionKind(dashv2beta1.DashboardPreferencesResourceInfo.GroupVersionKind())
	u.SetNamespace(namespace)
	u.SetName(name)
	return u
}

func deletedFolderObj(namespace, uid string) *foldersv1.Folder {
	return &foldersv1.Folder{ObjectMeta: metav1.ObjectMeta{Name: uid, Namespace: namespace}}
}

func requireDashboardPreferencesStored(t *testing.T, dyn *dynamicfake.FakeDynamicClient, namespace, name string) {
	t.Helper()
	_, err := dyn.Resource(prefsGVR).Namespace(namespace).Get(context.Background(), name, metav1.GetOptions{})
	require.NoError(t, err, "%s/%s should be stored", namespace, name)
}

func requireDashboardPreferencesGone(t *testing.T, dyn *dynamicfake.FakeDynamicClient, namespace, name string) {
	t.Helper()
	_, err := dyn.Resource(prefsGVR).Namespace(namespace).Get(context.Background(), name, metav1.GetOptions{})
	require.True(t, apierrors.IsNotFound(err), "%s/%s should be gone, got %v", namespace, name, err)
}

func logRecords(t *testing.T, logs *bytes.Buffer) []map[string]any {
	t.Helper()
	var records []map[string]any
	scanner := bufio.NewScanner(bytes.NewReader(logs.Bytes()))
	for scanner.Scan() {
		var record map[string]any
		require.NoError(t, json.Unmarshal(scanner.Bytes(), &record))
		records = append(records, record)
	}
	require.NoError(t, scanner.Err())
	return records
}

// captureDefaultLog sends the app SDK's default logger, which afterDelete logs to, to the returned
// buffer until the test ends.
func captureDefaultLog(t *testing.T) *bytes.Buffer {
	t.Helper()
	var logs bytes.Buffer
	previous := logging.DefaultLogger
	logging.DefaultLogger = logging.NewSLogLogger(slog.NewJSONHandler(&logs, nil))
	t.Cleanup(func() { logging.DefaultLogger = previous })
	return &logs
}

// recordingPreferencesClient records each delete, including its ctx, and returns err. With block
// set, a delete waits for its ctx to end.
type recordingPreferencesClient struct {
	dynamic.NamespaceableResourceInterface
	err   error
	block bool

	namespace string
	names     []string
	opts      []metav1.DeleteOptions
	ctxs      []context.Context
}

func (c *recordingPreferencesClient) Namespace(ns string) dynamic.ResourceInterface {
	c.namespace = ns
	return c
}

func (c *recordingPreferencesClient) Delete(ctx context.Context, name string, opts metav1.DeleteOptions, _ ...string) error {
	c.names = append(c.names, name)
	c.opts = append(c.opts, opts)
	c.ctxs = append(c.ctxs, ctx)
	if c.block {
		<-ctx.Done()
		return ctx.Err()
	}
	return c.err
}

func TestFolderAfterDelete_DashboardPreferences(t *testing.T) {
	newBuilder := func(dyn *dynamicfake.FakeDynamicClient) *FolderAPIBuilder {
		c := dyn.Resource(prefsGVR)
		return &FolderAPIBuilder{dashboardPreferencesSvc: &c}
	}
	rpGVR := iamv0.ResourcePermissionInfo.GroupVersionResource()
	folderGR := foldersv1.FolderResourceInfo.GroupVersionResource().GroupResource()
	// withResourcePermission wires a resource permission client holding the permission of folder f1.
	withResourcePermission := func(t *testing.T, b *FolderAPIBuilder) (dynamic.NamespaceableResourceInterface, string) {
		t.Helper()
		rpDyn := dynamicfake.NewSimpleDynamicClientWithCustomListKinds(runtime.NewScheme(), map[schema.GroupVersionResource]string{rpGVR: "ResourcePermissionList"})
		rpName := rpclient.Name(folderGR, "f1")
		_, err := rpDyn.Resource(rpGVR).Namespace("org-7").Create(context.Background(), &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": iamv0.ResourcePermissionInfo.GroupVersion().String(), "kind": "ResourcePermission",
			"metadata": map[string]any{"name": rpName, "namespace": "org-7"},
		}}, metav1.CreateOptions{})
		require.NoError(t, err)
		b.resourcePermissions = rpclient.New(rpclient.Static(rpDyn.Resource(rpGVR)), folderGR)
		return rpDyn.Resource(rpGVR), rpName
	}
	requireResourcePermissionGone := func(t *testing.T, rp dynamic.NamespaceableResourceInterface, name string) {
		t.Helper()
		_, err := rp.Namespace("org-7").Get(context.Background(), name, metav1.GetOptions{})
		require.True(t, apierrors.IsNotFound(err), "resource permission should be gone, got %v", err)
	}

	t.Run("deletes the deleted folder's tier and keeps others", func(t *testing.T) {
		dyn := newDashboardPreferencesFake()
		seedDashboardPreferences(t, dyn, "org-7", "folder-f1", "folder-f2")

		newBuilder(dyn).afterDelete(deletedFolderObj("org-7", "f1"), &metav1.DeleteOptions{})

		requireDashboardPreferencesGone(t, dyn, "org-7", "folder-f1")
		requireDashboardPreferencesStored(t, dyn, "org-7", "folder-f2")
	})

	t.Run("nil options deletes", func(t *testing.T) {
		dyn := newDashboardPreferencesFake()
		seedDashboardPreferences(t, dyn, "org-7", "folder-f1")

		newBuilder(dyn).afterDelete(deletedFolderObj("org-7", "f1"), nil)

		requireDashboardPreferencesGone(t, dyn, "org-7", "folder-f1")
	})

	t.Run("no client configured does nothing", func(t *testing.T) {
		b := &FolderAPIBuilder{}
		rp, rpName := withResourcePermission(t, b)

		require.NotPanics(t, func() {
			b.afterDelete(deletedFolderObj("org-7", "f1"), &metav1.DeleteOptions{})
		})

		requireResourcePermissionGone(t, rp, rpName)
	})

	t.Run("runs before the resource permission cleanup returns", func(t *testing.T) {
		dyn := newDashboardPreferencesFake()
		seedDashboardPreferences(t, dyn, "org-7", "folder-f1")
		b := newBuilder(dyn)
		rp, rpName := withResourcePermission(t, b)

		b.afterDelete(deletedFolderObj("org-7", "f1"), &metav1.DeleteOptions{})

		requireResourcePermissionGone(t, rp, rpName)
		requireDashboardPreferencesGone(t, dyn, "org-7", "folder-f1")
	})

	t.Run("a failed tier delete still removes the resource permission", func(t *testing.T) {
		dyn := newDashboardPreferencesFake()
		seedDashboardPreferences(t, dyn, "org-7", "folder-f1")
		dyn.PrependReactor("delete", "dashboardpreferences", func(k8stesting.Action) (bool, runtime.Object, error) {
			return true, nil, apierrors.NewInternalError(errors.New("boom"))
		})
		b := newBuilder(dyn)
		rp, rpName := withResourcePermission(t, b)

		require.NotPanics(t, func() {
			b.afterDelete(deletedFolderObj("org-7", "f1"), &metav1.DeleteOptions{})
		})

		requireResourcePermissionGone(t, rp, rpName)
	})

	t.Run("deletes as the service identity limited to the folder's namespace", func(t *testing.T) {
		c := &recordingPreferencesClient{}
		var ri dynamic.NamespaceableResourceInterface = c
		b := &FolderAPIBuilder{dashboardPreferencesSvc: &ri}

		b.afterDelete(deletedFolderObj("org-7", "f1"), &metav1.DeleteOptions{})

		require.Equal(t, "org-7", c.namespace)
		require.Equal(t, []string{"folder-f1"}, c.names)
		require.Equal(t, []metav1.DeleteOptions{{}}, c.opts)
		ctx := c.ctxs[0]
		require.True(t, identity.IsServiceIdentity(ctx))
		requester, err := identity.GetRequester(ctx)
		require.NoError(t, err)
		require.Equal(t, "org-7", requester.GetNamespace())
		_, hasDeadline := ctx.Deadline()
		require.True(t, hasDeadline)
	})

	for _, tc := range []struct {
		name      string
		deleteErr error
		wantLevel string
	}{
		{
			name:      "a dashboard API that doesn't serve dashboard preferences is logged at Warn",
			deleteErr: apierrors.NewGenericServerResponse(http.StatusNotFound, http.MethodDelete, prefsGVR.GroupResource(), "folder-f1", "404 page not found", 0, true),
			wantLevel: "WARN",
		},
		{
			name:      "any other failure is logged at Error",
			deleteErr: apierrors.NewInternalError(errors.New("boom")),
			wantLevel: "ERROR",
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			logs := captureDefaultLog(t)
			c := &recordingPreferencesClient{err: tc.deleteErr}
			var ri dynamic.NamespaceableResourceInterface = c
			b := &FolderAPIBuilder{dashboardPreferencesSvc: &ri}

			b.afterDelete(deletedFolderObj("org-7", "f1"), &metav1.DeleteOptions{})

			require.Equal(t, []string{"folder-f1"}, c.names)
			records := logRecords(t, logs)
			require.Len(t, records, 1)
			require.Equal(t, tc.wantLevel, records[0]["level"])
			require.Equal(t, "failed to delete folder dashboard preferences", records[0]["msg"])
			require.Equal(t, "f1", records[0]["folder"])
		})
	}
}

func TestFolderAfterDelete_DashboardPreferencesTimeout(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		c := &recordingPreferencesClient{block: true}
		var ri dynamic.NamespaceableResourceInterface = c
		b := &FolderAPIBuilder{dashboardPreferencesSvc: &ri}
		start := time.Now()

		b.afterDelete(deletedFolderObj("org-7", "f1"), &metav1.DeleteOptions{})

		require.Equal(t, afterDeleteTimeout, time.Since(start))
		require.ErrorIs(t, c.ctxs[0].Err(), context.DeadlineExceeded)
	})
}

func TestNewAPIService_WithDashboardPreferencesClient(t *testing.T) {
	dyn := newDashboardPreferencesFake()
	seedDashboardPreferences(t, dyn, "org-7", "folder-f1")
	client := dyn.Resource(prefsGVR)

	b := NewAPIService(nil, nil, featuremgmt.WithFeatures(), nil, nil, nil, nil, 0, nil, WithDashboardPreferencesClient(&client))
	b.afterDelete(deletedFolderObj("org-7", "f1"), &metav1.DeleteOptions{})

	requireDashboardPreferencesGone(t, dyn, "org-7", "folder-f1")
}
