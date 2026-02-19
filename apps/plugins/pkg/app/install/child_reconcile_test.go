package install

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
	"github.com/grafana/grafana/apps/plugins/pkg/app/meta"
)

func TestChildPluginReconciler_ReconcileWithChildren(t *testing.T) {
	tests := []struct {
		name                string
		action              operator.ReconcileAction
		children            []string
		version             string
		wantRegistered      int
		wantUnregistered    int
		wantRegisteredIDs   []string
		wantUnregisteredIDs []string
		checkVersion        string
	}{
		{
			name:              "Created with multiple children",
			action:            operator.ReconcileActionCreated,
			children:          []string{"child-plugin-1", "child-plugin-2"},
			version:           "1.0.0",
			wantRegistered:    2,
			wantRegisteredIDs: []string{"child-plugin-1", "child-plugin-2"},
			checkVersion:      "1.0.0",
		},
		{
			name:              "Updated with single child",
			action:            operator.ReconcileActionUpdated,
			children:          []string{"child-plugin-1"},
			version:           "2.0.0",
			wantRegistered:    1,
			wantRegisteredIDs: []string{"child-plugin-1"},
			checkVersion:      "2.0.0",
		},
		{
			name:              "Resynced with single child",
			action:            operator.ReconcileActionResynced,
			children:          []string{"child-plugin-1"},
			version:           "1.0.0",
			wantRegistered:    1,
			wantRegisteredIDs: []string{"child-plugin-1"},
			checkVersion:      "1.0.0",
		},
		{
			name:                "Deleted with multiple children",
			action:              operator.ReconcileActionDeleted,
			children:            []string{"child-plugin-1", "child-plugin-2"},
			version:             "1.0.0",
			wantUnregistered:    2,
			wantUnregisteredIDs: []string{"child-plugin-1", "child-plugin-2"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockProv := &mockMetaProvider{
				getMetaFunc: func(ctx context.Context, ref meta.PluginRef) (*meta.Result, error) {
					return &meta.Result{
						Meta: pluginsv0alpha1.MetaSpec{
							Children: tt.children,
						},
						TTL: 5 * time.Minute,
					}, nil
				},
			}
			metaManager := meta.NewProviderManager(mockProv)

			mockReg := newMockPluginRegistrar()
			reconciler := NewChildPluginReconciler(metaManager, mockReg)

			plugin := &pluginsv0alpha1.Plugin{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-plugin",
					Namespace: "default",
				},
				Spec: pluginsv0alpha1.PluginSpec{
					Id:      "test-plugin",
					Version: tt.version,
				},
			}

			req := operator.TypedReconcileRequest[*pluginsv0alpha1.Plugin]{
				Action: tt.action,
				Object: plugin,
			}

			result, err := reconciler.reconcile(context.Background(), req)

			require.NoError(t, err)
			require.Equal(t, operator.ReconcileResult{}, result)

			// Verify registered children
			if tt.wantRegistered > 0 {
				require.Len(t, mockReg.registered, tt.wantRegistered)
				for _, id := range tt.wantRegisteredIDs {
					require.Contains(t, mockReg.registered, id)
				}

				// Verify children have correct properties
				for childID, install := range mockReg.registered {
					require.Equal(t, "test-plugin", install.ParentID, "Child %s should have correct parent ID", childID)
					require.Equal(t, tt.checkVersion, install.Version, "Child %s should have correct version", childID)
					require.Equal(t, SourceChildPluginReconciler, install.Source, "Child %s should have correct source", childID)
				}
			}

			// Verify unregistered children
			if tt.wantUnregistered > 0 {
				require.Len(t, mockReg.unregistered, tt.wantUnregistered)
				for _, id := range tt.wantUnregisteredIDs {
					require.True(t, mockReg.unregistered[id])
				}
				require.Empty(t, mockReg.registered)
			}
		})
	}
}

func TestChildPluginReconciler_ReconcileSpecialCases(t *testing.T) {
	tests := []struct {
		name               string
		children           []string
		parentID           *string
		shouldCallGetMeta  bool
		wantRegistered     int
		wantRegisteredIDs  []string
		getMetaFatalOnCall bool
	}{
		{
			name:              "No children",
			children:          []string{},
			shouldCallGetMeta: true,
			wantRegistered:    0,
		},
		{
			name:               "ParentId already set",
			children:           []string{"child-plugin-1"},
			parentID:           func() *string { s := "parent-plugin"; return &s }(),
			shouldCallGetMeta:  false,
			wantRegistered:     0,
			getMetaFatalOnCall: true,
		},
		{
			name:              "Empty ParentId allows reconciliation",
			children:          []string{"child-plugin-1"},
			parentID:          func() *string { s := ""; return &s }(),
			shouldCallGetMeta: true,
			wantRegistered:    1,
			wantRegisteredIDs: []string{"child-plugin-1"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockProv := &mockMetaProvider{
				getMetaFunc: func(ctx context.Context, ref meta.PluginRef) (*meta.Result, error) {
					if tt.getMetaFatalOnCall {
						t.Fatal("GetMeta should not be called when parent ID is already set")
					}
					return &meta.Result{
						Meta: pluginsv0alpha1.MetaSpec{
							Children: tt.children,
						},
						TTL: 5 * time.Minute,
					}, nil
				},
			}
			metaManager := meta.NewProviderManager(mockProv)

			mockReg := newMockPluginRegistrar()
			reconciler := NewChildPluginReconciler(metaManager, mockReg)

			plugin := &pluginsv0alpha1.Plugin{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-plugin",
					Namespace: "default",
				},
				Spec: pluginsv0alpha1.PluginSpec{
					Id:       "test-plugin",
					Version:  "1.0.0",
					ParentId: tt.parentID,
				},
			}

			req := operator.TypedReconcileRequest[*pluginsv0alpha1.Plugin]{
				Action: operator.ReconcileActionCreated,
				Object: plugin,
			}

			result, err := reconciler.reconcile(context.Background(), req)

			require.NoError(t, err)
			require.Equal(t, operator.ReconcileResult{}, result)

			require.Len(t, mockReg.registered, tt.wantRegistered)
			for _, id := range tt.wantRegisteredIDs {
				require.Contains(t, mockReg.registered, id)
			}
		})
	}
}

func TestChildPluginReconciler_ReconcileMetaErrors(t *testing.T) {
	tests := []struct {
		name             string
		metaErr          error
		wantRequeueAfter *time.Duration
	}{
		{
			name:             "Meta not found",
			metaErr:          meta.ErrMetaNotFound,
			wantRequeueAfter: func() *time.Duration { d := 10 * time.Second; return &d }(),
		},
		{
			name:             "Provider error",
			metaErr:          errors.New("provider error"),
			wantRequeueAfter: func() *time.Duration { d := 10 * time.Second; return &d }(),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockProv := &mockMetaProvider{
				getMetaFunc: func(ctx context.Context, ref meta.PluginRef) (*meta.Result, error) {
					return nil, tt.metaErr
				},
			}
			metaManager := meta.NewProviderManager(mockProv)

			mockReg := newMockPluginRegistrar()
			reconciler := NewChildPluginReconciler(metaManager, mockReg)

			plugin := &pluginsv0alpha1.Plugin{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-plugin",
					Namespace: "default",
				},
				Spec: pluginsv0alpha1.PluginSpec{
					Id:      "test-plugin",
					Version: "1.0.0",
				},
			}

			req := operator.TypedReconcileRequest[*pluginsv0alpha1.Plugin]{
				Action: operator.ReconcileActionCreated,
				Object: plugin,
			}

			result, err := reconciler.reconcile(context.Background(), req)

			require.NoError(t, err)
			require.NotNil(t, result.RequeueAfter)
			require.Equal(t, *tt.wantRequeueAfter, *result.RequeueAfter)

			// Verify no children were registered
			require.Empty(t, mockReg.registered)
		})
	}
}

func TestChildPluginReconciler_PartialFailures(t *testing.T) {
	tests := []struct {
		name                string
		action              operator.ReconcileAction
		children            []string
		failOnPlugin        string
		failureErr          error
		wantRequeueAfter    *time.Duration
		wantRegistered      []string
		wantUnregistered    []string
		wantNotRegistered   []string
		wantNotUnregistered []string
	}{
		{
			name:              "Register children partial failure",
			action:            operator.ReconcileActionCreated,
			children:          []string{"child-plugin-1", "child-plugin-2", "child-plugin-3"},
			failOnPlugin:      "child-plugin-2",
			failureErr:        errors.New("registration failed"),
			wantRequeueAfter:  func() *time.Duration { d := 10 * time.Second; return &d }(),
			wantRegistered:    []string{"child-plugin-1", "child-plugin-3"},
			wantNotRegistered: []string{"child-plugin-2"},
		},
		{
			name:                "Unregister children partial failure",
			action:              operator.ReconcileActionDeleted,
			children:            []string{"child-plugin-1", "child-plugin-2", "child-plugin-3"},
			failOnPlugin:        "child-plugin-2",
			failureErr:          errors.New("unregistration failed"),
			wantRequeueAfter:    func() *time.Duration { d := 10 * time.Second; return &d }(),
			wantUnregistered:    []string{"child-plugin-1", "child-plugin-3"},
			wantNotUnregistered: []string{"child-plugin-2"},
		},
		{
			name:             "Unregister children NotFound ignored",
			action:           operator.ReconcileActionDeleted,
			children:         []string{"child-plugin-1", "child-plugin-2"},
			failOnPlugin:     "child-plugin-1",
			failureErr:       apierrors.NewNotFound(schema.GroupResource{}, "child-plugin-1"),
			wantRequeueAfter: nil,
			wantUnregistered: []string{"child-plugin-2"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockProv := &mockMetaProvider{
				getMetaFunc: func(ctx context.Context, ref meta.PluginRef) (*meta.Result, error) {
					return &meta.Result{
						Meta: pluginsv0alpha1.MetaSpec{
							Children: tt.children,
						},
						TTL: 5 * time.Minute,
					}, nil
				},
			}
			metaManager := meta.NewProviderManager(mockProv)

			mockReg := newMockPluginRegistrar()

			// Setup register function for register tests
			if tt.action == operator.ReconcileActionCreated {
				mockReg.registerFunc = func(ctx context.Context, namespace string, install *PluginInstall) error {
					if install.ID == tt.failOnPlugin {
						return tt.failureErr
					}
					mockReg.registered[install.ID] = install
					return nil
				}
			}

			// Setup unregister function for unregister tests
			if tt.action == operator.ReconcileActionDeleted {
				mockReg.unregisterFunc = func(ctx context.Context, namespace string, name string, source Source) error {
					if name == tt.failOnPlugin {
						return tt.failureErr
					}
					mockReg.unregistered[name] = true
					return nil
				}
			}

			reconciler := NewChildPluginReconciler(metaManager, mockReg)

			plugin := &pluginsv0alpha1.Plugin{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-plugin",
					Namespace: "default",
				},
				Spec: pluginsv0alpha1.PluginSpec{
					Id:      "test-plugin",
					Version: "1.0.0",
				},
			}

			req := operator.TypedReconcileRequest[*pluginsv0alpha1.Plugin]{
				Action: tt.action,
				Object: plugin,
			}

			result, err := reconciler.reconcile(context.Background(), req)

			require.NoError(t, err)
			if tt.wantRequeueAfter != nil {
				require.NotNil(t, result.RequeueAfter)
				require.Equal(t, *tt.wantRequeueAfter, *result.RequeueAfter)
			} else {
				require.Nil(t, result.RequeueAfter)
			}

			// Verify registered children
			if len(tt.wantRegistered) > 0 {
				require.Len(t, mockReg.registered, len(tt.wantRegistered))
				for _, id := range tt.wantRegistered {
					require.Contains(t, mockReg.registered, id)
				}
			}
			for _, id := range tt.wantNotRegistered {
				require.NotContains(t, mockReg.registered, id)
			}

			// Verify unregistered children
			if len(tt.wantUnregistered) > 0 {
				require.Len(t, mockReg.unregistered, len(tt.wantUnregistered))
				for _, id := range tt.wantUnregistered {
					require.True(t, mockReg.unregistered[id])
				}
			}
			for _, id := range tt.wantNotUnregistered {
				require.False(t, mockReg.unregistered[id])
			}
		})
	}
}

func TestChildPluginReconciler_ReconcileInvalidAction(t *testing.T) {
	mockProv := &mockMetaProvider{
		getMetaFunc: func(ctx context.Context, ref meta.PluginRef) (*meta.Result, error) {
			return &meta.Result{
				Meta: pluginsv0alpha1.MetaSpec{
					Children: []string{"child-plugin-1"},
				},
				TTL: 5 * time.Minute,
			}, nil
		},
	}
	metaManager := meta.NewProviderManager(mockProv)

	mockReg := newMockPluginRegistrar()
	reconciler := NewChildPluginReconciler(metaManager, mockReg)

	plugin := &pluginsv0alpha1.Plugin{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-plugin",
			Namespace: "default",
		},
		Spec: pluginsv0alpha1.PluginSpec{
			Id:      "test-plugin",
			Version: "1.0.0",
		},
	}

	// Use an invalid action value
	req := operator.TypedReconcileRequest[*pluginsv0alpha1.Plugin]{
		Action: operator.ReconcileAction(999),
		Object: plugin,
	}

	result, err := reconciler.reconcile(context.Background(), req)

	// Should return error for invalid action
	require.Error(t, err)
	require.Contains(t, err.Error(), "invalid action")
	require.Equal(t, operator.ReconcileResult{}, result)
}

// mockMetaProvider implements meta.Provider for testing
type mockMetaProvider struct {
	getMetaFunc func(ctx context.Context, ref meta.PluginRef) (*meta.Result, error)
}

func (m *mockMetaProvider) GetMeta(ctx context.Context, ref meta.PluginRef) (*meta.Result, error) {
	if m.getMetaFunc != nil {
		return m.getMetaFunc(ctx, ref)
	}
	return nil, meta.ErrMetaNotFound
}

// mockPluginRegistrar implements Registrar for testing
type mockPluginRegistrar struct {
	registerFunc   func(ctx context.Context, namespace string, install *PluginInstall) error
	unregisterFunc func(ctx context.Context, namespace string, name string, source Source) error
	registered     map[string]*PluginInstall
	unregistered   map[string]bool
}

func newMockPluginRegistrar() *mockPluginRegistrar {
	return &mockPluginRegistrar{
		registered:   make(map[string]*PluginInstall),
		unregistered: make(map[string]bool),
	}
}

func (m *mockPluginRegistrar) Register(ctx context.Context, namespace string, install *PluginInstall) error {
	if m.registerFunc != nil {
		return m.registerFunc(ctx, namespace, install)
	}
	m.registered[install.ID] = install
	return nil
}

func (m *mockPluginRegistrar) Unregister(ctx context.Context, namespace string, name string, source Source) error {
	if m.unregisterFunc != nil {
		return m.unregisterFunc(ctx, namespace, name, source)
	}
	m.unregistered[name] = true
	delete(m.registered, name)
	return nil
}
