package reconciler

import (
	"context"
	"testing"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	dynamicfake "k8s.io/client-go/dynamic/fake"
	clienttesting "k8s.io/client-go/testing"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
)

// --- fakes for resources.ClientFactory / ResourceClients ---

type fakeAnonClientFactory struct {
	dyn            dynamic.Interface
	forResourceErr error
}

func (f fakeAnonClientFactory) Clients(_ context.Context, ns string) (resources.ResourceClients, error) {
	return fakeAnonResourceClients{dyn: f.dyn, ns: ns, forResourceErr: f.forResourceErr}, nil
}

type fakeAnonResourceClients struct {
	dyn            dynamic.Interface
	ns             string
	forResourceErr error
}

func (f fakeAnonResourceClients) ForResource(_ context.Context, gvr schema.GroupVersionResource) (dynamic.ResourceInterface, schema.GroupVersionKind, error) {
	if f.forResourceErr != nil {
		return nil, schema.GroupVersionKind{}, f.forResourceErr
	}
	return f.dyn.Resource(gvr).Namespace(f.ns), schema.GroupVersionKind{}, nil
}

func (f fakeAnonResourceClients) ForKind(context.Context, schema.GroupVersionKind) (dynamic.ResourceInterface, schema.GroupVersionResource, error) {
	return nil, schema.GroupVersionResource{}, nil
}

func (f fakeAnonResourceClients) Folder(context.Context) (dynamic.ResourceInterface, schema.GroupVersionKind, error) {
	return nil, schema.GroupVersionKind{}, nil
}

func (f fakeAnonResourceClients) User(context.Context) (dynamic.ResourceInterface, error) {
	return nil, nil
}

func (f fakeAnonResourceClients) SupportedResources() []resources.SupportedResource {
	return nil
}

func anonSetting(section, key, value string) *unstructured.Unstructured {
	return &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "setting.grafana.app/v1beta1",
		"kind":       "Setting",
		"metadata": map[string]any{
			"name":      section + "-" + key,
			"namespace": "stacks-11",
			"labels":    map[string]any{"section": section, "key": key},
		},
		"spec": map[string]any{
			"section": section,
			"key":     key,
			"value":   value,
		},
	}}
}

func newAnonReconciler(dyn dynamic.Interface) *Reconciler {
	return &Reconciler{
		clientFactory: fakeAnonClientFactory{dyn: dyn},
		cfg:           Config{},
		logger:        log.NewNopLogger(),
		tracer:        tracing.NewNoopTracerService(),
		metrics:       newReconcilerMetrics(prometheus.NewRegistry()),
	}
}

func newFakeSettingsClient(objs ...runtime.Object) dynamic.Interface {
	scheme := runtime.NewScheme()
	listKinds := map[schema.GroupVersionResource]string{
		anonymousSettingsGVR: "SettingList",
	}
	return dynamicfake.NewSimpleDynamicClientWithCustomListKinds(scheme, listKinds, objs...)
}

func wantAnonTuple(basicRole string) *openfgav1.TupleKey {
	return &openfgav1.TupleKey{
		User:     common.NewTupleEntry(common.TypeAnonymous, anonymousUserID, ""),
		Relation: common.RelationAssignee,
		Object:   common.NewTupleEntry(common.TypeRole, basicRole, ""),
	}
}

func TestAddAnonymousTuples(t *testing.T) {
	ctx := context.Background()

	t.Run("enabled with explicit Editor role", func(t *testing.T) {
		dyn := newFakeSettingsClient(
			anonSetting("auth.anonymous", "enabled", "true"),
			anonSetting("auth.anonymous", "org_role", "Editor"),
		)
		r := newAnonReconciler(dyn)

		dest := map[string]*openfgav1.TupleKey{}
		require.NoError(t, r.fetchAnonymousTuples(ctx, "stacks-11", dest))

		want := wantAnonTuple("basic_editor")
		got, ok := dest[tupleKey(want)]
		require.True(t, ok, "expected anonymous tuple to be present")
		assert.Equal(t, want.GetObject(), got.GetObject())
		assert.Equal(t, want.GetUser(), got.GetUser())
		assert.Equal(t, want.GetRelation(), got.GetRelation())
		assert.Len(t, dest, 1)
	})

	t.Run("enabled without org_role defaults to Viewer", func(t *testing.T) {
		dyn := newFakeSettingsClient(
			anonSetting("auth.anonymous", "enabled", "true"),
		)
		r := newAnonReconciler(dyn)

		dest := map[string]*openfgav1.TupleKey{}
		require.NoError(t, r.fetchAnonymousTuples(ctx, "stacks-11", dest))

		_, ok := dest[tupleKey(wantAnonTuple("basic_viewer"))]
		assert.True(t, ok, "expected anonymous tuple with default Viewer role")
	})

	t.Run("disabled produces no tuple", func(t *testing.T) {
		dyn := newFakeSettingsClient(
			anonSetting("auth.anonymous", "enabled", "false"),
			anonSetting("auth.anonymous", "org_role", "Admin"),
		)
		r := newAnonReconciler(dyn)

		dest := map[string]*openfgav1.TupleKey{}
		require.NoError(t, r.fetchAnonymousTuples(ctx, "stacks-11", dest))
		assert.Empty(t, dest)
	})

	t.Run("no settings produces no tuple", func(t *testing.T) {
		dyn := newFakeSettingsClient()
		r := newAnonReconciler(dyn)

		dest := map[string]*openfgav1.TupleKey{}
		require.NoError(t, r.fetchAnonymousTuples(ctx, "stacks-11", dest))
		assert.Empty(t, dest)
	})

	t.Run("invalid org_role is skipped", func(t *testing.T) {
		dyn := newFakeSettingsClient(
			anonSetting("auth.anonymous", "enabled", "true"),
			anonSetting("auth.anonymous", "org_role", "Superuser"),
		)
		r := newAnonReconciler(dyn)

		dest := map[string]*openfgav1.TupleKey{}
		require.NoError(t, r.fetchAnonymousTuples(ctx, "stacks-11", dest))
		assert.Empty(t, dest)
	})

	t.Run("unrelated section is ignored", func(t *testing.T) {
		dyn := newFakeSettingsClient(
			anonSetting("server", "org_role", "Admin"), // must not be treated as anonymous config
			anonSetting("auth.anonymous", "enabled", "true"),
			anonSetting("auth.anonymous", "org_role", "Viewer"),
		)
		r := newAnonReconciler(dyn)

		dest := map[string]*openfgav1.TupleKey{}
		require.NoError(t, r.fetchAnonymousTuples(ctx, "stacks-11", dest))

		_, ok := dest[tupleKey(wantAnonTuple("basic_viewer"))]
		assert.True(t, ok)
		assert.Len(t, dest, 1)
	})

	t.Run("preserves pre-existing tuples in dest", func(t *testing.T) {
		dyn := newFakeSettingsClient(
			anonSetting("auth.anonymous", "enabled", "true"),
			anonSetting("auth.anonymous", "org_role", "Viewer"),
		)
		r := newAnonReconciler(dyn)

		existing := makeTuple("user:1", "assignee", "role:basic_admin")
		dest := map[string]*openfgav1.TupleKey{tupleKey(existing): existing}
		require.NoError(t, r.fetchAnonymousTuples(ctx, "stacks-11", dest))

		assert.Len(t, dest, 2)
		_, ok := dest[tupleKey(wantAnonTuple("basic_viewer"))]
		assert.True(t, ok)
	})

	t.Run("unavailable settings apiserver is a clean skip", func(t *testing.T) {
		// When the settings apiserver is not wired (ForResource fails), anonymous
		// reconciliation is skipped without error and without adding/removing tuples.
		r := &Reconciler{
			clientFactory: fakeAnonClientFactory{
				dyn:            newFakeSettingsClient(),
				forResourceErr: apierrors.NewNotFound(schema.GroupResource{Resource: "settings"}, ""),
			},
			cfg:     Config{},
			logger:  log.NewNopLogger(),
			tracer:  tracing.NewNoopTracerService(),
			metrics: newReconcilerMetrics(prometheus.NewRegistry()),
		}

		dest := map[string]*openfgav1.TupleKey{}
		require.NoError(t, r.fetchAnonymousTuples(ctx, "stacks-11", dest))
		assert.Empty(t, dest)
	})

	t.Run("list failure aborts and does not leak as IsNotFound", func(t *testing.T) {
		// A failure listing settings (client exists) must abort the reconcile, but the
		// error must not satisfy IsNotFound, otherwise reconcileNamespace would delete the store.
		dyn := newFakeSettingsClient()
		fake := dyn.(*dynamicfake.FakeDynamicClient)
		fake.PrependReactor("list", "settings", func(clienttesting.Action) (bool, runtime.Object, error) {
			return true, nil, apierrors.NewNotFound(schema.GroupResource{Resource: "settings"}, "")
		})
		r := newAnonReconciler(dyn)

		dest := map[string]*openfgav1.TupleKey{}
		err := r.fetchAnonymousTuples(ctx, "stacks-11", dest)
		require.Error(t, err)
		assert.False(t, apierrors.IsNotFound(err), "settings list NotFound must not leak as IsNotFound")
		assert.Empty(t, dest)
	})
}
