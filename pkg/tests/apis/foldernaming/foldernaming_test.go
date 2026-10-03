package foldernaming

import (
	"context"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/client-go/dynamic"

	foldersv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	foldernamingv0alpha1 "github.com/grafana/grafana/apps/foldernaming/pkg/apis/foldernaming/v0alpha1"
	policyv0alpha1 "github.com/grafana/grafana/apps/policy/pkg/apis/policy/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

const (
	namespace = "default"
	// The reconciler and the policy watches are asynchronous, so enforcement starts shortly after a
	// FolderNamingPolicy is written.
	eventually = 30 * time.Second
	tick       = 250 * time.Millisecond
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

// warnings collects the warnings returned by the API server.
type warnings struct {
	mu       sync.Mutex
	messages []string
}

func (w *warnings) HandleWarningHeader(_ int, _ string, text string) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.messages = append(w.messages, text)
}

func (w *warnings) take() []string {
	w.mu.Lock()
	defer w.mu.Unlock()
	out := w.messages
	w.messages = nil
	return out
}

func TestIntegrationFolderNaming(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	ctx := context.Background()

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		APIServerRuntimeConfig: "policy.grafana.app/v0alpha1=true,foldernaming.grafana.app/v0alpha1=true",
	})

	adminWarnings := &warnings{}
	adminCfg := helper.Org1.Admin.NewRestConfig()
	adminCfg.WarningHandler = adminWarnings
	admin, err := dynamic.NewForConfig(adminCfg)
	require.NoError(t, err)

	namingPolicies := admin.Resource(foldernamingv0alpha1.FolderNamingPolicyKind().GroupVersionResource()).Namespace(namespace)
	folders := admin.Resource(foldersv1.FolderResourceInfo.GroupVersionResource()).Namespace(namespace)
	bindings := admin.Resource(policyv0alpha1.ValidationPolicyBindingKind().GroupVersionResource()).Namespace(namespace)

	folderCount := 0
	createFolder := func(title string) (*unstructured.Unstructured, error) {
		folderCount++
		return folders.Create(ctx, &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": foldersv1.FolderResourceInfo.GroupVersion().String(),
			"kind":       "Folder",
			"metadata":   map[string]any{"name": fmt.Sprintf("folder-%d", folderCount), "namespace": namespace},
			"spec":       map[string]any{"title": title},
		}}, metav1.CreateOptions{})
	}
	updateFolder := func(name string, mutate func(spec map[string]any)) error {
		f, err := folders.Get(ctx, name, metav1.GetOptions{})
		if err != nil {
			return err
		}
		spec, _, _ := unstructured.NestedMap(f.Object, "spec")
		mutate(spec)
		if err := unstructured.SetNestedMap(f.Object, spec, "spec"); err != nil {
			return err
		}
		_, err = folders.Update(ctx, f, metav1.UpdateOptions{})
		return err
	}
	createNamingPolicy := func(name string, enforcement foldernamingv0alpha1.FolderNamingPolicyEnforcement, pattern, description string) error {
		spec := map[string]any{"enforcement": string(enforcement), "titlePattern": pattern}
		if description != "" {
			spec["description"] = description
		}
		_, err := namingPolicies.Create(ctx, &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": foldernamingv0alpha1.GroupVersion.String(),
			"kind":       foldernamingv0alpha1.FolderNamingPolicyKind().Kind(),
			"metadata":   map[string]any{"name": name, "namespace": namespace},
			"spec":       spec,
		}}, metav1.CreateOptions{})
		return err
	}

	// Created before any convention exists, so it does not follow one.
	legacy, err := createFolder("Legacy")
	require.NoError(t, err)

	t.Run("invalid patterns are rejected", func(t *testing.T) {
		err := createNamingPolicy("broken", foldernamingv0alpha1.FolderNamingPolicyEnforcementDeny, `(?<=a)b`, "")
		// The app SDK reports every validator rejection as Forbidden, with the field errors in the message.
		require.True(t, apierrors.IsForbidden(err), "got %v", err)
		require.Contains(t, err.Error(), "spec.titlePattern")
	})

	t.Run("a deny policy rejects folders that break the convention", func(t *testing.T) {
		require.NoError(t, createNamingPolicy("team-prefix", foldernamingv0alpha1.FolderNamingPolicyEnforcementDeny,
			`[a-z0-9-]+: .+`, "start with the owning team, like 'team-a: Alerts'"))

		require.EventuallyWithT(t, func(c *assert.CollectT) {
			_, err := bindings.Get(ctx, "foldernaming-team-prefix", metav1.GetOptions{})
			assert.NoError(c, err)
		}, eventually, tick)

		require.EventuallyWithT(t, func(c *assert.CollectT) {
			_, err := createFolder("Alerts")
			require.Error(c, err)
			assert.True(c, apierrors.IsInvalid(err), "got %v", err)
			assert.Contains(c, err.Error(), `folder title "Alerts" does not follow the naming convention: start with the owning team`)
		}, eventually, tick)

		_, err := createFolder("team-a: Alerts")
		require.NoError(t, err)
	})

	t.Run("existing folders can be updated but renames must follow the convention", func(t *testing.T) {
		require.NoError(t, updateFolder(legacy.GetName(), func(spec map[string]any) { spec["description"] = "still here" }))

		err := updateFolder(legacy.GetName(), func(spec map[string]any) { spec["title"] = "Still legacy" })
		require.True(t, apierrors.IsInvalid(err), "got %v", err)

		require.NoError(t, updateFolder(legacy.GetName(), func(spec map[string]any) { spec["title"] = "team-a: Legacy" }))
	})

	t.Run("a warn policy admits with a warning", func(t *testing.T) {
		require.NoError(t, createNamingPolicy("short", foldernamingv0alpha1.FolderNamingPolicyEnforcementWarn, `.{1,20}`, ""))
		require.EventuallyWithT(t, func(c *assert.CollectT) {
			adminWarnings.take()
			_, err := createFolder("team-a: a folder title that is too long")
			require.NoError(c, err)
			assert.Contains(c, fmt.Sprint(adminWarnings.take()), "does not follow the naming convention .{1,20}")
		}, eventually, tick)
	})

	t.Run("deleting a policy stops its enforcement", func(t *testing.T) {
		require.NoError(t, namingPolicies.Delete(ctx, "team-prefix", metav1.DeleteOptions{}))
		require.EventuallyWithT(t, func(c *assert.CollectT) {
			_, err := createFolder("Anything")
			assert.NoError(c, err)
		}, eventually, tick)
	})
}
