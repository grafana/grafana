package logsdrilldown

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/dynamic"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

const group = "logsdrilldown.grafana.app"

var (
	settingsGVR = schema.GroupVersionResource{Group: group, Version: "v1alpha1", Resource: "logsdrilldowns"}
	defaultsGVR = schema.GroupVersionResource{Group: group, Version: "v1alpha1", Resource: "logsdrilldowndefaults"}
	columnsGVR  = schema.GroupVersionResource{Group: group, Version: "v1beta1", Resource: "logsdrilldowndefaultcolumns"}
	labelsGVR   = schema.GroupVersionResource{Group: group, Version: "v1beta1", Resource: "logsdrilldowndefaultlabels"}
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

// outcome reduces a response to what a caller can tell apart.
func outcome(err error) string {
	if err == nil {
		return "ok"
	}
	var status apierrors.APIStatus
	if errors.As(err, &status) {
		return fmt.Sprintf("%d %s", status.Status().Code, status.Status().Reason)
	}
	return err.Error()
}

func newObject(gvr schema.GroupVersionResource, kind, name string, spec map[string]any) *unstructured.Unstructured {
	return &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": gvr.GroupVersion().String(),
		"kind":       kind,
		"metadata":   map[string]any{"name": name},
		"spec":       spec,
	}}
}

func settingsSpec(wrap bool) map[string]any {
	return map[string]any{
		"defaultFields":      []any{"level"},
		"prettifyJSON":       false,
		"wrapLogMessage":     wrap,
		"interceptDismissed": false,
	}
}

func columnsSpec(column string) map[string]any {
	return map[string]any{"records": []any{map[string]any{
		"columns": []any{column},
		"labels":  []any{map[string]any{"key": "service_name", "value": "api"}},
	}}}
}

func labelsSpec(label string) map[string]any {
	return map[string]any{"records": []any{map[string]any{
		"label":  label,
		"values": []any{"api"},
	}}}
}

// runScenario exercises every Logs Drilldown kind as the users the legacy
// authorizer tells apart, and returns what each step did, so the legacy and
// routed servers can be compared.
func runScenario(t *testing.T, routed bool) []string {
	flags := []string{featuremgmt.FlagKubernetesLogsDrilldown}
	if routed {
		flags = append(flags,
			featuremgmt.FlagGrafanaUseRouterMiddleware,
			featuremgmt.FlagRouterRegisterCoreAPIs,
			featuremgmt.FlagApppluginsLoadAppManifest,
		)
	}
	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction:    false, // required for experimental APIs
		DisableAnonymous:     true,
		LocalPluginAPI:       routed,
		EnableFeatureToggles: flags,
	})

	if routed {
		helper.WaitForCoreApp(group)
	}

	// The editor can explore, so owns settings; the viewer can't. The org
	// admin of another org has plugins:write but is not a server admin.
	owner := helper.Org1.Editor
	viewer := helper.Org1.Viewer
	serverAdmin := helper.Org1.Admin
	orgAdmin := helper.OrgB.Admin
	client := func(u apis.User, gvr schema.GroupVersionResource) dynamic.ResourceInterface {
		return helper.GetResourceClient(apis.ResourceClientArgs{User: u, GVR: gvr}).Resource
	}
	uid := func(u apis.User) string {
		_, id, ok := strings.Cut(u.Identity.GetUID(), ":")
		require.True(t, ok, "unexpected identity uid %q", u.Identity.GetUID())
		return id
	}

	ctx := context.Background()
	var steps []string
	record := func(step string, err error) {
		t.Helper()
		steps = append(steps, step+": "+outcome(err))
	}

	// Per-user settings: everyone reads them, and only the owner writes.
	ownName := "logs:" + uid(owner)
	_, err := client(owner, settingsGVR).Create(ctx, newObject(settingsGVR, "LogsDrilldown", ownName, settingsSpec(false)), metav1.CreateOptions{})
	record("owner creates own settings", err)
	require.NoError(t, err)

	got, err := client(owner, settingsGVR).Get(ctx, ownName, metav1.GetOptions{})
	record("owner gets own settings", err)
	require.NoError(t, err)

	_, err = client(viewer, settingsGVR).Get(ctx, ownName, metav1.GetOptions{})
	record("viewer gets owner's settings", err)

	list, err := client(owner, settingsGVR).List(ctx, metav1.ListOptions{})
	record("owner lists settings", err)
	require.NoError(t, err)
	steps = append(steps, fmt.Sprintf("owner lists settings: %d items", len(list.Items)))

	got.Object["spec"] = settingsSpec(true)
	updated, err := client(owner, settingsGVR).Update(ctx, got, metav1.UpdateOptions{})
	record("owner updates own settings", err)
	require.NoError(t, err)

	_, err = client(viewer, settingsGVR).Update(ctx, updated, metav1.UpdateOptions{})
	record("viewer updates owner's settings", err)
	require.Error(t, err)

	_, err = client(viewer, settingsGVR).Patch(ctx, ownName, types.MergePatchType, []byte(`{"spec":{"wrapLogMessage":false}}`), metav1.PatchOptions{})
	record("viewer patches owner's settings", err)
	require.Error(t, err)

	_, err = client(owner, settingsGVR).Patch(ctx, "other:"+uid(owner), types.MergePatchType, []byte(`{"spec":{"wrapLogMessage":false}}`), metav1.PatchOptions{})
	record("owner patches missing settings", err)
	require.True(t, apierrors.IsNotFound(err), "a patch must not create the object: %v", err)

	err = client(viewer, settingsGVR).Delete(ctx, ownName, metav1.DeleteOptions{})
	record("viewer deletes owner's settings", err)
	require.Error(t, err)

	_, err = client(serverAdmin, settingsGVR).Get(ctx, ownName, metav1.GetOptions{})
	record("server admin gets owner's settings", err)
	require.NoError(t, err)

	// The embedded API server never checks the name in a create, so a user may
	// create another user's settings there. The router checks it.
	if routed {
		_, err = client(owner, settingsGVR).Create(ctx, newObject(settingsGVR, "LogsDrilldown", "logs:"+uid(viewer), settingsSpec(false)), metav1.CreateOptions{})
		require.True(t, apierrors.IsInvalid(err), "a create for another user must be refused: %v", err)
	}

	err = client(owner, settingsGVR).Delete(ctx, ownName, metav1.DeleteOptions{})
	record("owner deletes own settings", err)
	require.NoError(t, err)

	// Defaults: everyone reads them, and only Grafana server admins write
	// (plugins:install on the routed path).
	_, err = client(orgAdmin, defaultsGVR).Create(ctx, newObject(defaultsGVR, "LogsDrilldownDefaults", "defaults", settingsSpec(false)), metav1.CreateOptions{})
	record("org admin creates defaults", err)
	require.Error(t, err)

	_, err = client(serverAdmin, defaultsGVR).Create(ctx, newObject(defaultsGVR, "LogsDrilldownDefaults", "defaults", settingsSpec(false)), metav1.CreateOptions{})
	record("server admin creates defaults", err)
	require.NoError(t, err)

	_, err = client(viewer, defaultsGVR).Get(ctx, "defaults", metav1.GetOptions{})
	record("viewer gets defaults", err)
	require.NoError(t, err)

	_, err = client(viewer, defaultsGVR).List(ctx, metav1.ListOptions{})
	record("viewer lists defaults", err)
	require.NoError(t, err)

	err = client(owner, defaultsGVR).Delete(ctx, "defaults", metav1.DeleteOptions{})
	record("editor deletes defaults", err)
	require.Error(t, err)

	// Default columns and labels: plugins:write is needed to change them.
	for _, kind := range []struct {
		name string
		gvr  schema.GroupVersionResource
		kind string
		spec func(string) map[string]any
	}{
		{"columns", columnsGVR, "LogsDrilldownDefaultColumns", columnsSpec},
		{"labels", labelsGVR, "LogsDrilldownDefaultLabels", labelsSpec},
	} {
		_, err = client(owner, kind.gvr).Create(ctx, newObject(kind.gvr, kind.kind, "defaults", kind.spec("a")), metav1.CreateOptions{})
		record("editor creates default "+kind.name, err)
		require.Error(t, err)

		created, err := client(orgAdmin, kind.gvr).Create(ctx, newObject(kind.gvr, kind.kind, "defaults", kind.spec("a")), metav1.CreateOptions{})
		record("org admin creates default "+kind.name, err)
		require.NoError(t, err)

		_, err = client(serverAdmin, kind.gvr).Create(ctx, newObject(kind.gvr, kind.kind, "defaults", kind.spec("a")), metav1.CreateOptions{})
		record("server admin creates default "+kind.name, err)
		require.NoError(t, err)

		_, err = client(viewer, kind.gvr).Get(ctx, "defaults", metav1.GetOptions{})
		record("viewer gets default "+kind.name, err)
		require.NoError(t, err)

		// The embedded API server needs plugins:write to list the default
		// columns. The router serves every list of the defaults kinds as the
		// service, like any get of them.
		_, err = client(viewer, kind.gvr).List(ctx, metav1.ListOptions{})
		if kind.name == "columns" {
			if routed {
				require.NoError(t, err)
			} else {
				require.True(t, apierrors.IsForbidden(err), "got %v", err)
			}
		} else {
			record("viewer lists default "+kind.name, err)
		}

		_, err = client(orgAdmin, kind.gvr).List(ctx, metav1.ListOptions{})
		record("org admin lists default "+kind.name, err)
		require.NoError(t, err)

		created.Object["spec"] = kind.spec("b")
		_, err = client(viewer, kind.gvr).Update(ctx, created, metav1.UpdateOptions{})
		record("viewer updates default "+kind.name, err)
		require.Error(t, err)

		_, err = client(orgAdmin, kind.gvr).Update(ctx, created, metav1.UpdateOptions{})
		record("org admin updates default "+kind.name, err)
		require.NoError(t, err)

		err = client(orgAdmin, kind.gvr).Delete(ctx, "defaults", metav1.DeleteOptions{})
		record("org admin deletes default "+kind.name, err)
		require.NoError(t, err)
	}

	return steps
}

func TestIntegrationLogsDrilldown(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	var legacy, routed []string
	t.Run("legacy", func(t *testing.T) { legacy = runScenario(t, false) })
	t.Run("routed", func(t *testing.T) { routed = runScenario(t, true) })

	// The router must answer as the embedded API server does.
	require.Equal(t, legacy, routed)
}
