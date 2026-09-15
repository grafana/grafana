package app

import (
	"context"
	"errors"
	"fmt"
	"sync/atomic"
	"testing"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	k8srequest "k8s.io/apiserver/pkg/endpoints/request"

	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
	"github.com/grafana/grafana/apps/plugins/pkg/app/meta"
)

func TestMetaStorage_List_Parallel(t *testing.T) {
	var active atomic.Int32
	var concurrent atomic.Bool

	provider := meta.NewProviderManager(&slowProvider{
		delay: 20 * time.Millisecond,
		meta: pluginsv0alpha1.MetaSpec{
			PluginJson: pluginsv0alpha1.MetaJSONData{Id: "test"},
		},
		active:     &active,
		concurrent: &concurrent,
	})

	plugins := make([]pluginsv0alpha1.Plugin, 10)
	for i := range plugins {
		plugins[i] = pluginsv0alpha1.Plugin{
			ObjectMeta: metav1.ObjectMeta{Name: "plugin-" + string(rune('a'+i)), Namespace: "default"},
			Spec:       pluginsv0alpha1.PluginSpec{Id: "plugin-" + string(rune('a'+i)), Version: "1.0.0"},
		}
	}

	mockClient := &mockResourceClient{
		listFunc: func(_ context.Context, _ string, _ resource.ListOptions) (resource.ListObject, error) {
			return &pluginsv0alpha1.PluginList{Items: plugins}, nil
		},
	}

	storage := NewMetaStorage(&logging.NoOpLogger{}, provider, func(_ context.Context) (*pluginsv0alpha1.PluginClient, error) {
		return pluginsv0alpha1.NewPluginClient(mockClient), nil
	})

	result, err := storage.List(testContext("default"), nil)
	require.NoError(t, err)

	list := result.(*pluginsv0alpha1.MetaList)
	assert.Len(t, list.Items, 10)

	assert.True(t, concurrent.Load(), "GetMeta calls should run concurrently")
}

func TestMetaStorage_List_PreservesOrder(t *testing.T) {
	provider := meta.NewProviderManager(&stubProvider{
		meta: pluginsv0alpha1.MetaSpec{
			PluginJson: pluginsv0alpha1.MetaJSONData{Id: "test"},
		},
	})

	plugins := make([]pluginsv0alpha1.Plugin, 20)
	for i := range plugins {
		name := "plugin-" + string(rune('a'+i))
		plugins[i] = pluginsv0alpha1.Plugin{
			ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: "default"},
			Spec:       pluginsv0alpha1.PluginSpec{Id: name, Version: "1.0.0"},
		}
	}

	mockClient := &mockResourceClient{
		listFunc: func(_ context.Context, _ string, _ resource.ListOptions) (resource.ListObject, error) {
			return &pluginsv0alpha1.PluginList{Items: plugins}, nil
		},
	}

	storage := NewMetaStorage(&logging.NoOpLogger{}, provider, func(_ context.Context) (*pluginsv0alpha1.PluginClient, error) {
		return pluginsv0alpha1.NewPluginClient(mockClient), nil
	})

	result, err := storage.List(testContext("default"), nil)
	require.NoError(t, err)

	list := result.(*pluginsv0alpha1.MetaList)
	require.Len(t, list.Items, 20)

	for i, item := range list.Items {
		expected := "plugin-" + string(rune('a'+i))
		assert.Equal(t, expected, item.Name, "item at index %d should preserve input order", i)
	}
}

func TestMetaStorage_List_SkipsFailedPlugins(t *testing.T) {
	provider := meta.NewProviderManager(&selectiveProvider{
		succeedIDs: map[string]bool{"good-plugin": true},
	})

	mockClient := &mockResourceClient{
		listFunc: func(_ context.Context, _ string, _ resource.ListOptions) (resource.ListObject, error) {
			return &pluginsv0alpha1.PluginList{
				Items: []pluginsv0alpha1.Plugin{
					{ObjectMeta: metav1.ObjectMeta{Name: "good-plugin", Namespace: "default"}, Spec: pluginsv0alpha1.PluginSpec{Id: "good-plugin", Version: "1.0.0"}},
					{ObjectMeta: metav1.ObjectMeta{Name: "bad-plugin", Namespace: "default"}, Spec: pluginsv0alpha1.PluginSpec{Id: "bad-plugin", Version: "1.0.0"}},
					{ObjectMeta: metav1.ObjectMeta{Name: "another-bad-plugin", Namespace: "default"}, Spec: pluginsv0alpha1.PluginSpec{Id: "another-bad-plugin", Version: "1.0.0"}},
				},
			}, nil
		},
	}

	storage := NewMetaStorage(&logging.NoOpLogger{}, provider, func(_ context.Context) (*pluginsv0alpha1.PluginClient, error) {
		return pluginsv0alpha1.NewPluginClient(mockClient), nil
	})

	result, err := storage.List(testContext("default"), nil)
	require.NoError(t, err)

	list := result.(*pluginsv0alpha1.MetaList)
	require.Len(t, list.Items, 1)
	assert.Equal(t, "good-plugin", list.Items[0].Name)
}

func TestMetaStorage_List_ClientCancelledIsNotReportedAsServerFault(t *testing.T) {
	provider := meta.NewProviderManager(&stubProvider{})

	mockClient := &mockResourceClient{
		listFunc: func(_ context.Context, _ string, _ resource.ListOptions) (resource.ListObject, error) {
			return nil, context.Canceled
		},
	}

	storage := NewMetaStorage(&logging.NoOpLogger{}, provider, func(_ context.Context) (*pluginsv0alpha1.PluginClient, error) {
		return pluginsv0alpha1.NewPluginClient(mockClient), nil
	})

	_, err := storage.List(testContext("default"), nil)
	require.Error(t, err)

	var statusErr *apierrors.StatusError
	require.True(t, errors.As(err, &statusErr), "expected a *apierrors.StatusError, got %T", err)
	assert.EqualValues(t, 499, statusErr.Status().Code, "a client cancellation must not be reported as a 500")
}

func TestWrapStorageError(t *testing.T) {
	gr := schema.GroupResource{Group: "plugins.grafana.app", Resource: "metas"}

	t.Run("context.Canceled maps to 499, not 500", func(t *testing.T) {
		err := wrapStorageError(fmt.Errorf("failed to list plugins: %w", context.Canceled), "get", gr, "test-plugin")

		var statusErr *apierrors.StatusError
		require.True(t, errors.As(err, &statusErr))
		assert.EqualValues(t, 499, statusErr.Status().Code)
		// apierrors.NewGenericServerResponse would silently discard the real
		// error text for an unrecognized code like 499 -- guard against
		// reintroducing that by asserting our message actually survives.
		assert.Contains(t, statusErr.Status().Message, "failed to list plugins")

		require.NotNil(t, statusErr.Status().Details)
		assert.Equal(t, gr.Group, statusErr.Status().Details.Group)
		assert.Equal(t, gr.Resource, statusErr.Status().Details.Kind)
		assert.Equal(t, "test-plugin", statusErr.Status().Details.Name)
	})

	t.Run("context.DeadlineExceeded maps to 504, not 500", func(t *testing.T) {
		err := wrapStorageError(context.DeadlineExceeded, "list", gr, "")

		var statusErr *apierrors.StatusError
		require.True(t, errors.As(err, &statusErr))
		assert.EqualValues(t, 504, statusErr.Status().Code)
	})

	t.Run("a wrapped context.Canceled is still detected", func(t *testing.T) {
		err := wrapStorageError(fmt.Errorf("failed to list plugins: %w", context.Canceled), "list", gr, "")

		var statusErr *apierrors.StatusError
		require.True(t, errors.As(err, &statusErr))
		assert.EqualValues(t, 499, statusErr.Status().Code)
	})

	t.Run("other errors still map to 500", func(t *testing.T) {
		err := wrapStorageError(errors.New("boom"), "get", gr, "test-plugin")

		var statusErr *apierrors.StatusError
		require.True(t, errors.As(err, &statusErr))
		assert.EqualValues(t, 500, statusErr.Status().Code)
	})
}

// stubProvider always returns the same MetaSpec.
type stubProvider struct {
	meta pluginsv0alpha1.MetaSpec
}

func (s *stubProvider) Name() string {
	return "stub"
}

func (s *stubProvider) GetMeta(_ context.Context, _ meta.PluginRef) (*meta.Result, error) {
	return &meta.Result{Meta: s.meta, TTL: time.Hour}, nil
}

// slowProvider simulates latency per GetMeta call and tracks whether
// multiple goroutines were ever active at the same time.
type slowProvider struct {
	delay      time.Duration
	meta       pluginsv0alpha1.MetaSpec
	active     *atomic.Int32
	concurrent *atomic.Bool
}

func (s *slowProvider) Name() string {
	return "slow"
}

func (s *slowProvider) GetMeta(_ context.Context, _ meta.PluginRef) (*meta.Result, error) {
	if s.active.Add(1) > 1 {
		s.concurrent.Store(true)
	}
	time.Sleep(s.delay)
	s.active.Add(-1)
	return &meta.Result{Meta: s.meta, TTL: time.Hour}, nil
}

// selectiveProvider only succeeds for plugins in succeedIDs.
type selectiveProvider struct {
	succeedIDs map[string]bool
}

func (s *selectiveProvider) Name() string {
	return "selective"
}

func (s *selectiveProvider) GetMeta(_ context.Context, ref meta.PluginRef) (*meta.Result, error) {
	if s.succeedIDs[ref.ID] {
		return &meta.Result{
			Meta: pluginsv0alpha1.MetaSpec{PluginJson: pluginsv0alpha1.MetaJSONData{Id: ref.ID}},
			TTL:  time.Hour,
		}, nil
	}
	return nil, meta.ErrMetaNotFound
}

// mockResourceClient implements resource.Client with only List wired up.
type mockResourceClient struct {
	resource.Client
	listFunc func(ctx context.Context, namespace string, opts resource.ListOptions) (resource.ListObject, error)
}

func (m *mockResourceClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (resource.ListObject, error) {
	return m.listFunc(ctx, namespace, opts)
}

func (m *mockResourceClient) ListInto(ctx context.Context, namespace string, opts resource.ListOptions, into resource.ListObject) error {
	list, err := m.listFunc(ctx, namespace, opts)
	if err != nil {
		return err
	}
	into.SetItems(list.GetItems())
	return nil
}

func testContext(namespace string) context.Context {
	return k8srequest.WithNamespace(context.Background(), namespace)
}
