package install

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
	"github.com/grafana/grafana/apps/plugins/pkg/app/meta"
	"github.com/grafana/grafana/apps/plugins/pkg/app/metrics"
)

func TestChildPluginReconciler_ReconcileWithChildren(t *testing.T) {
	tests := []struct {
		name                string
		action              operator.ReconcileAction
		children            []string
		version             string
		storedChildren      []string
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
			name:              "Resynced without stored state bootstraps from metadata",
			action:            operator.ReconcileActionResynced,
			children:          []string{"child-plugin-1"},
			version:           "1.0.0",
			wantRegistered:    1,
			wantRegisteredIDs: []string{"child-plugin-1"},
			checkVersion:      "1.0.0",
		},
		{
			name:                "Deleted uses stored children",
			action:              operator.ReconcileActionDeleted,
			version:             "1.0.0",
			storedChildren:      []string{"child-plugin-1", "child-plugin-2"},
			wantUnregistered:    2,
			wantUnregisteredIDs: []string{"child-plugin-1", "child-plugin-2"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockProv := &mockMetaProvider{
				getMetaFunc: func(ctx context.Context, ref meta.PluginRef) (*meta.Result, error) {
					return &meta.Result{
						Meta: pluginsv0alpha1.MetaSpec{Children: tt.children},
						TTL:  5 * time.Minute,
					}, nil
				},
			}
			metaManager := meta.NewProviderManager(mockProv)

			mockReg := newMockPluginRegistrar()
			reconciler := NewChildPluginReconciler(&logging.NoOpLogger{}, metaManager, mockReg)

			plugin := newTestPlugin("test-plugin-app", tt.version)
			if len(tt.storedChildren) > 0 {
				withStoredChildren(plugin, 1, pluginsv0alpha1.PluginStatusOperatorStateStateSuccess, tt.storedChildren)
			}

			req := operator.TypedReconcileRequest[*pluginsv0alpha1.Plugin]{
				Action: tt.action,
				Object: plugin,
			}

			result, err := reconciler.reconcile(context.Background(), req)

			require.NoError(t, err)
			require.Equal(t, operator.ReconcileResult{}, result)

			if tt.wantRegistered > 0 {
				require.Len(t, mockReg.registered, tt.wantRegistered)
				for _, id := range tt.wantRegisteredIDs {
					require.Contains(t, mockReg.registered, id)
				}
				for childID, install := range mockReg.registered {
					require.Equal(t, "test-plugin-app", install.ParentID, "Child %s should have correct parent ID", childID)
					require.Equal(t, tt.checkVersion, install.Version, "Child %s should have correct version", childID)
					require.Equal(t, SourceChildPluginReconciler, install.Source, "Child %s should have correct source", childID)
				}
			}

			if tt.wantUnregistered > 0 {
				require.Len(t, mockReg.unregistered, tt.wantUnregistered)
				for _, id := range tt.wantUnregisteredIDs {
					require.True(t, mockReg.unregistered[id])
				}
			}
		})
	}
}

func TestChildPluginReconciler_ReconcileSpecialCases(t *testing.T) {
	tests := []struct {
		name               string
		children           []string
		parentID           *string
		id                 string
		wantStatusUpdates  int
		wantRegistered     int
		wantRegisteredIDs  []string
		getMetaFatalOnCall bool
	}{
		{
			name:              "No children",
			id:                "test-plugin-app",
			children:          []string{},
			wantStatusUpdates: 1,
			wantRegistered:    0,
		},
		{
			name:               "ParentId already set",
			id:                 "test-plugin-app",
			children:           []string{"child-plugin-1"},
			parentID:           strPtr("parent-plugin"),
			wantStatusUpdates:  0,
			wantRegistered:     0,
			getMetaFatalOnCall: true,
		},
		{
			name:              "Empty ParentId allows reconciliation",
			id:                "test-plugin-app",
			children:          []string{"child-plugin-1"},
			parentID:          strPtr(""),
			wantStatusUpdates: 1,
			wantRegistered:    1,
			wantRegisteredIDs: []string{"child-plugin-1"},
		},
		{
			name:               "Non-app plugin ID is skipped before metadata lookup",
			id:                 "test-plugin",
			children:           []string{"child-plugin-1"},
			wantStatusUpdates:  0,
			wantRegistered:     0,
			getMetaFatalOnCall: true,
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
						Meta: pluginsv0alpha1.MetaSpec{Children: tt.children},
						TTL:  5 * time.Minute,
					}, nil
				},
			}
			metaManager := meta.NewProviderManager(mockProv)

			mockReg := newMockPluginRegistrar()
			reconciler := NewChildPluginReconciler(&logging.NoOpLogger{}, metaManager, mockReg)

			plugin := newTestPlugin(tt.id, "1.0.0")
			plugin.Spec.ParentId = tt.parentID

			req := operator.TypedReconcileRequest[*pluginsv0alpha1.Plugin]{
				Action: operator.ReconcileActionCreated,
				Object: plugin,
			}

			result, err := reconciler.reconcile(context.Background(), req)

			require.NoError(t, err)
			require.Equal(t, operator.ReconcileResult{}, result)
			require.Len(t, mockReg.registered, tt.wantRegistered)
			require.Len(t, mockReg.updatedStatuses, tt.wantStatusUpdates)
			for _, id := range tt.wantRegisteredIDs {
				require.Contains(t, mockReg.registered, id)
			}
		})
	}
}

func TestChildPluginReconciler_ReconcileSkipsRetryWhenMetaNotFound(t *testing.T) {
	resetChildReconciliationMetrics(t)

	mockProv := &mockMetaProvider{
		getMetaFunc: func(ctx context.Context, ref meta.PluginRef) (*meta.Result, error) {
			return nil, meta.ErrMetaNotFound
		},
	}
	metaManager := meta.NewProviderManager(mockProv)

	mockReg := newMockPluginRegistrar()
	reconciler := NewChildPluginReconciler(&logging.NoOpLogger{}, metaManager, mockReg)

	plugin := newTestPlugin("test-plugin-app", "1.0.0")
	req := operator.TypedReconcileRequest[*pluginsv0alpha1.Plugin]{
		Action: operator.ReconcileActionCreated,
		Object: plugin,
	}

	result, err := reconciler.reconcile(context.Background(), req)

	require.NoError(t, err)
	require.Equal(t, operator.ReconcileResult{}, result)
	require.Empty(t, mockReg.registered)
	require.Empty(t, mockReg.updatedStatuses)
	require.Equal(t, 1.0, childReconciliationMetricValue(t, childReconciliationStatusSkippedMetaNotFound, operator.ReconcileActionCreated, "test-plugin-app"))
	require.Equal(t, 0.0, childReconciliationMetricValue(t, childReconciliationStatusSuccess, operator.ReconcileActionCreated, "test-plugin-app"))
}

func TestChildPluginReconciler_ReconcileMetaErrors(t *testing.T) {
	providerErr := errors.New("provider error")
	mockProv := &mockMetaProvider{
		getMetaFunc: func(ctx context.Context, ref meta.PluginRef) (*meta.Result, error) {
			return nil, providerErr
		},
	}
	metaManager := meta.NewProviderManager(mockProv)

	mockReg := newMockPluginRegistrar()
	reconciler := NewChildPluginReconciler(&logging.NoOpLogger{}, metaManager, mockReg)

	plugin := newTestPlugin("test-plugin-app", "1.0.0")
	req := operator.TypedReconcileRequest[*pluginsv0alpha1.Plugin]{
		Action: operator.ReconcileActionCreated,
		Object: plugin,
	}

	result, err := reconciler.reconcile(context.Background(), req)

	require.ErrorIs(t, err, providerErr)
	var reconcileErr *ChildPluginReconcilerError
	require.ErrorAs(t, err, &reconcileErr)
	require.Equal(t, ChildPluginReconcilerFailureSourceMetadataLookup, reconcileErr.Source)
	require.Equal(t, "test-plugin-app", reconcileErr.PluginID)
	require.Equal(t, "1.0.0", reconcileErr.Version)
	require.Equal(t, "default", reconcileErr.Namespace)
	require.Equal(t, operator.ReconcileResult{}, result)
	require.Empty(t, mockReg.registered)
	require.Len(t, mockReg.updatedStatuses, 1)
	require.Equal(t, pluginsv0alpha1.PluginStatusOperatorStateStateFailed, mockReg.updatedStatuses[0].OperatorStates[childReconcilerStatusKey].State)
}

func TestChildPluginReconciler_PartialFailures(t *testing.T) {
	tests := []struct {
		name                string
		action              operator.ReconcileAction
		children            []string
		storedChildren      []string
		failOnPlugin        string
		failureErr          error
		wantErr             bool
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
			wantErr:           true,
			wantRegistered:    []string{"child-plugin-1", "child-plugin-3"},
			wantNotRegistered: []string{"child-plugin-2"},
		},
		{
			name:                "Unregister children partial failure",
			action:              operator.ReconcileActionDeleted,
			storedChildren:      []string{"child-plugin-1", "child-plugin-2", "child-plugin-3"},
			failOnPlugin:        "child-plugin-2",
			failureErr:          errors.New("unregistration failed"),
			wantErr:             true,
			wantUnregistered:    []string{"child-plugin-1", "child-plugin-3"},
			wantNotUnregistered: []string{"child-plugin-2"},
		},
		{
			name:             "Unregister children NotFound ignored",
			action:           operator.ReconcileActionDeleted,
			storedChildren:   []string{"child-plugin-1", "child-plugin-2"},
			failOnPlugin:     "child-plugin-1",
			failureErr:       apierrors.NewNotFound(schema.GroupResource{}, "child-plugin-1"),
			wantErr:          false,
			wantUnregistered: []string{"child-plugin-2"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockProv := &mockMetaProvider{
				getMetaFunc: func(ctx context.Context, ref meta.PluginRef) (*meta.Result, error) {
					return &meta.Result{
						Meta: pluginsv0alpha1.MetaSpec{Children: tt.children},
						TTL:  5 * time.Minute,
					}, nil
				},
			}
			metaManager := meta.NewProviderManager(mockProv)

			mockReg := newMockPluginRegistrar()
			if tt.action == operator.ReconcileActionCreated {
				mockReg.registerFunc = func(ctx context.Context, namespace string, install *PluginInstall) error {
					if install.ID == tt.failOnPlugin {
						return tt.failureErr
					}
					mockReg.registered[install.ID] = install
					return nil
				}
			}
			if tt.action == operator.ReconcileActionDeleted {
				mockReg.unregisterFunc = func(ctx context.Context, namespace string, name string, source Source) error {
					if name == tt.failOnPlugin {
						return tt.failureErr
					}
					mockReg.unregistered[name] = true
					return nil
				}
			}

			reconciler := NewChildPluginReconciler(&logging.NoOpLogger{}, metaManager, mockReg)

			plugin := newTestPlugin("test-plugin-app", "1.0.0")
			withStoredChildren(plugin, 1, pluginsv0alpha1.PluginStatusOperatorStateStateSuccess, tt.storedChildren)

			req := operator.TypedReconcileRequest[*pluginsv0alpha1.Plugin]{
				Action: tt.action,
				Object: plugin,
			}

			result, err := reconciler.reconcile(context.Background(), req)

			if tt.wantErr {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}
			require.Equal(t, operator.ReconcileResult{}, result)

			if len(tt.wantRegistered) > 0 {
				require.Len(t, mockReg.registered, len(tt.wantRegistered))
				for _, id := range tt.wantRegistered {
					require.Contains(t, mockReg.registered, id)
				}
			}
			for _, id := range tt.wantNotRegistered {
				require.NotContains(t, mockReg.registered, id)
			}

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

func TestChildPluginReconciler_ContextCancellation(t *testing.T) {
	children := buildChildList(10)

	mockProv := &mockMetaProvider{
		getMetaFunc: func(ctx context.Context, ref meta.PluginRef) (*meta.Result, error) {
			return &meta.Result{
				Meta: pluginsv0alpha1.MetaSpec{Children: children},
				TTL:  5 * time.Minute,
			}, nil
		},
	}
	metaManager := meta.NewProviderManager(mockProv)

	ctx, cancel := context.WithCancel(context.Background())
	callCount := 0
	cancelAfter := 3

	mockReg := newMockPluginRegistrar()
	mockReg.registerFunc = func(_ context.Context, namespace string, install *PluginInstall) error {
		callCount++
		if callCount == cancelAfter {
			cancel()
		}
		mockReg.registered[install.ID] = install
		return nil
	}

	reconciler := NewChildPluginReconciler(&logging.NoOpLogger{}, metaManager, mockReg)

	plugin := newTestPlugin("test-plugin-app", "1.0.0")
	req := operator.TypedReconcileRequest[*pluginsv0alpha1.Plugin]{
		Action: operator.ReconcileActionCreated,
		Object: plugin,
	}

	result, err := reconciler.reconcile(ctx, req)

	require.ErrorIs(t, err, context.Canceled)
	require.Equal(t, operator.ReconcileResult{}, result)
	require.LessOrEqual(t, len(mockReg.registered), cancelAfter)
}

func TestChildPluginReconciler_ReconcileInvalidAction(t *testing.T) {
	mockProv := &mockMetaProvider{
		getMetaFunc: func(ctx context.Context, ref meta.PluginRef) (*meta.Result, error) {
			return &meta.Result{
				Meta: pluginsv0alpha1.MetaSpec{Children: []string{"child-plugin-1"}},
				TTL:  5 * time.Minute,
			}, nil
		},
	}
	metaManager := meta.NewProviderManager(mockProv)

	mockReg := newMockPluginRegistrar()
	reconciler := NewChildPluginReconciler(&logging.NoOpLogger{}, metaManager, mockReg)

	plugin := newTestPlugin("test-plugin-app", "1.0.0")
	req := operator.TypedReconcileRequest[*pluginsv0alpha1.Plugin]{
		Action: operator.ReconcileAction(999),
		Object: plugin,
	}

	result, err := reconciler.reconcile(context.Background(), req)

	require.Error(t, err)
	require.Contains(t, err.Error(), "invalid action")
	require.Equal(t, operator.ReconcileResult{}, result)
}

func TestChildPluginReconciler_SkipsWhenOwnedByAnotherShard(t *testing.T) {
	resetChildReconciliationMetrics(t)

	mockProv := &mockMetaProvider{
		getMetaFunc: func(context.Context, meta.PluginRef) (*meta.Result, error) {
			t.Fatal("GetMeta should not be called when the plugin belongs to a different shard")
			return nil, nil
		},
	}
	metaManager := meta.NewProviderManager(mockProv)

	mockReg := newMockPluginRegistrar()
	reconciler := NewChildPluginReconciler(
		&logging.NoOpLogger{},
		metaManager,
		mockReg,
		mockOwnershipFilter{
			ownsFunc: func(context.Context, *pluginsv0alpha1.Plugin) (bool, error) {
				return false, nil
			},
		},
	)

	result, err := reconciler.reconcile(context.Background(), operator.TypedReconcileRequest[*pluginsv0alpha1.Plugin]{
		Action: operator.ReconcileActionCreated,
		Object: newTestPlugin("test-plugin-app", "1.0.0"),
	})

	require.NoError(t, err)
	require.Equal(t, operator.ReconcileResult{}, result)
	require.Empty(t, mockReg.registered)
	require.Empty(t, mockReg.unregistered)
	require.Empty(t, mockReg.updatedStatuses)
	require.Equal(t, 1.0, childReconciliationMetricValue(t, childReconciliationStatusSkippedShard, operator.ReconcileActionCreated, "test-plugin-app"))
	require.Equal(t, 0.0, childReconciliationMetricValue(t, childReconciliationStatusSuccess, operator.ReconcileActionCreated, "test-plugin-app"))
}

func TestChildPluginReconciler_ReturnsOwnershipErrors(t *testing.T) {
	resetChildReconciliationMetrics(t)

	expectedErr := errors.New("ring unavailable")
	mockProv := &mockMetaProvider{
		getMetaFunc: func(context.Context, meta.PluginRef) (*meta.Result, error) {
			t.Fatal("GetMeta should not be called when shard ownership resolution fails")
			return nil, nil
		},
	}
	metaManager := meta.NewProviderManager(mockProv)

	mockReg := newMockPluginRegistrar()
	reconciler := NewChildPluginReconciler(
		&logging.NoOpLogger{},
		metaManager,
		mockReg,
		mockOwnershipFilter{
			ownsFunc: func(context.Context, *pluginsv0alpha1.Plugin) (bool, error) {
				return false, expectedErr
			},
		},
	)

	result, err := reconciler.reconcile(context.Background(), operator.TypedReconcileRequest[*pluginsv0alpha1.Plugin]{
		Action: operator.ReconcileActionCreated,
		Object: newTestPlugin("test-plugin-app", "1.0.0"),
	})

	require.ErrorIs(t, err, expectedErr)
	require.Equal(t, operator.ReconcileResult{}, result)
	require.Empty(t, mockReg.registered)
	require.Empty(t, mockReg.unregistered)
	require.Empty(t, mockReg.updatedStatuses)
	require.Equal(t, 1.0, childReconciliationMetricValue(t, childReconciliationStatusError, operator.ReconcileActionCreated, "test-plugin-app"))
}

func TestChildPluginReconciler_UpdateRemovesStaleChildren(t *testing.T) {
	mockProv := &mockMetaProvider{
		getMetaFunc: func(ctx context.Context, ref meta.PluginRef) (*meta.Result, error) {
			return &meta.Result{
				Meta: pluginsv0alpha1.MetaSpec{Children: []string{"child-plugin-1"}},
				TTL:  5 * time.Minute,
			}, nil
		},
	}
	metaManager := meta.NewProviderManager(mockProv)

	mockReg := newMockPluginRegistrar()
	reconciler := NewChildPluginReconciler(&logging.NoOpLogger{}, metaManager, mockReg)

	plugin := newTestPlugin("test-plugin-app", "2.0.0")
	plugin.Generation = 7
	withStoredChildren(plugin, 6, pluginsv0alpha1.PluginStatusOperatorStateStateSuccess, []string{"child-plugin-1", "child-plugin-2"})

	req := operator.TypedReconcileRequest[*pluginsv0alpha1.Plugin]{
		Action: operator.ReconcileActionUpdated,
		Object: plugin,
	}

	result, err := reconciler.reconcile(context.Background(), req)

	require.NoError(t, err)
	require.Equal(t, operator.ReconcileResult{}, result)
	require.Contains(t, mockReg.unregistered, "child-plugin-2")
	require.Contains(t, mockReg.registered, "child-plugin-1")
	require.Len(t, mockReg.updatedStatuses, 1)

	state := mockReg.updatedStatuses[0].OperatorStates[childReconcilerStatusKey]
	require.Equal(t, pluginsv0alpha1.PluginStatusOperatorStateStateSuccess, state.State)
	require.Nil(t, state.Details)
	require.Equal(t, []string{"child-plugin-1"}, mockReg.updatedStatuses[0].ChildAppliedChildren)
	require.NotNil(t, mockReg.updatedStatuses[0].ChildObservedGeneration)
	require.Equal(t, int64(7), *mockReg.updatedStatuses[0].ChildObservedGeneration)
}

func TestChildPluginReconciler_DeleteUsesStoredState(t *testing.T) {
	mockProv := &mockMetaProvider{
		getMetaFunc: func(ctx context.Context, ref meta.PluginRef) (*meta.Result, error) {
			t.Fatal("GetMeta should not be called for delete when stored state exists")
			return nil, nil
		},
	}
	metaManager := meta.NewProviderManager(mockProv)

	mockReg := newMockPluginRegistrar()
	reconciler := NewChildPluginReconciler(&logging.NoOpLogger{}, metaManager, mockReg)

	plugin := newTestPlugin("test-plugin-app", "1.0.0")
	withStoredChildren(plugin, 3, pluginsv0alpha1.PluginStatusOperatorStateStateSuccess, []string{"child-plugin-1", "child-plugin-2"})

	req := operator.TypedReconcileRequest[*pluginsv0alpha1.Plugin]{
		Action: operator.ReconcileActionDeleted,
		Object: plugin,
	}

	result, err := reconciler.reconcile(context.Background(), req)

	require.NoError(t, err)
	require.Equal(t, operator.ReconcileResult{}, result)
	require.True(t, mockReg.unregistered["child-plugin-1"])
	require.True(t, mockReg.unregistered["child-plugin-2"])
	require.Empty(t, mockReg.updatedStatuses)
}

func TestChildPluginReconciler_ResyncUsesStoredState(t *testing.T) {
	mockProv := &mockMetaProvider{
		getMetaFunc: func(ctx context.Context, ref meta.PluginRef) (*meta.Result, error) {
			t.Fatal("GetMeta should not be called for maintenance resync when stored state exists")
			return nil, nil
		},
	}
	metaManager := meta.NewProviderManager(mockProv)

	mockReg := newMockPluginRegistrar()
	reconciler := NewChildPluginReconciler(&logging.NoOpLogger{}, metaManager, mockReg)

	plugin := newTestPlugin("test-plugin-app", "1.0.0")
	plugin.Generation = 4
	withStoredChildren(plugin, 4, pluginsv0alpha1.PluginStatusOperatorStateStateSuccess, []string{"child-plugin-1"})
	mockReg.existing["child-plugin-1"] = (&PluginInstall{
		ID:       "child-plugin-1",
		Version:  "1.0.0",
		ParentID: "test-plugin-app",
		Source:   SourceChildPluginReconciler,
	}).ToPluginInstallV0Alpha1(plugin.Namespace)

	req := operator.TypedReconcileRequest[*pluginsv0alpha1.Plugin]{
		Action: operator.ReconcileActionResynced,
		Object: plugin,
	}

	result, err := reconciler.reconcile(context.Background(), req)

	require.NoError(t, err)
	require.Equal(t, operator.ReconcileResult{}, result)
	require.Empty(t, mockReg.registered)
	require.Empty(t, mockReg.unregistered)
	require.Empty(t, mockReg.updatedStatuses)
}

func TestChildPluginReconciler_ResyncRepairsMissingStoredChild(t *testing.T) {
	mockProv := &mockMetaProvider{
		getMetaFunc: func(ctx context.Context, ref meta.PluginRef) (*meta.Result, error) {
			t.Fatal("GetMeta should not be called for maintenance resync when stored state exists")
			return nil, nil
		},
	}
	metaManager := meta.NewProviderManager(mockProv)

	mockReg := newMockPluginRegistrar()
	reconciler := NewChildPluginReconciler(&logging.NoOpLogger{}, metaManager, mockReg)

	plugin := newTestPlugin("test-plugin-app", "1.0.0")
	plugin.Generation = 4
	withStoredChildren(plugin, 4, pluginsv0alpha1.PluginStatusOperatorStateStateSuccess, []string{"child-plugin-1"})

	req := operator.TypedReconcileRequest[*pluginsv0alpha1.Plugin]{
		Action: operator.ReconcileActionResynced,
		Object: plugin,
	}

	result, err := reconciler.reconcile(context.Background(), req)

	require.NoError(t, err)
	require.Equal(t, operator.ReconcileResult{}, result)
	require.Contains(t, mockReg.registered, "child-plugin-1")
	require.Empty(t, mockReg.unregistered)
	require.Empty(t, mockReg.updatedStatuses)
}

func TestChildPluginReconciler_UpdatedSkipsAlreadyReconciledGeneration(t *testing.T) {
	resetChildReconciliationMetrics(t)

	mockProv := &mockMetaProvider{
		getMetaFunc: func(ctx context.Context, ref meta.PluginRef) (*meta.Result, error) {
			t.Fatal("GetMeta should not be called for status-only updates")
			return nil, nil
		},
	}
	metaManager := meta.NewProviderManager(mockProv)

	mockReg := newMockPluginRegistrar()
	reconciler := NewChildPluginReconciler(&logging.NoOpLogger{}, metaManager, mockReg)

	plugin := newTestPlugin("test-plugin-app", "1.0.0")
	plugin.Generation = 5
	withStoredChildren(plugin, 5, pluginsv0alpha1.PluginStatusOperatorStateStateSuccess, []string{"child-plugin-1"})

	req := operator.TypedReconcileRequest[*pluginsv0alpha1.Plugin]{
		Action: operator.ReconcileActionUpdated,
		Object: plugin,
	}

	result, err := reconciler.reconcile(context.Background(), req)

	require.NoError(t, err)
	require.Equal(t, operator.ReconcileResult{}, result)
	require.Empty(t, mockReg.registered)
	require.Empty(t, mockReg.unregistered)
	require.Empty(t, mockReg.updatedStatuses)
	require.Equal(t, 1.0, childReconciliationMetricValue(t, childReconciliationStatusSkippedUpToDate, operator.ReconcileActionUpdated, "test-plugin-app"))
	require.Equal(t, 0.0, childReconciliationMetricValue(t, childReconciliationStatusSuccess, operator.ReconcileActionUpdated, "test-plugin-app"))
}

func TestChildPluginReconciler_UpdatedSkipsAlreadyReconciledGenerationFromLegacyDetails(t *testing.T) {
	resetChildReconciliationMetrics(t)

	mockProv := &mockMetaProvider{
		getMetaFunc: func(ctx context.Context, ref meta.PluginRef) (*meta.Result, error) {
			t.Fatal("GetMeta should not be called for status-only updates")
			return nil, nil
		},
	}
	metaManager := meta.NewProviderManager(mockProv)

	mockReg := newMockPluginRegistrar()
	reconciler := NewChildPluginReconciler(&logging.NoOpLogger{}, metaManager, mockReg)

	plugin := newTestPlugin("test-plugin-app", "1.0.0")
	plugin.Generation = 5
	withLegacyStoredChildren(plugin, 5, pluginsv0alpha1.PluginStatusOperatorStateStateSuccess, []string{"child-plugin-1"})

	req := operator.TypedReconcileRequest[*pluginsv0alpha1.Plugin]{
		Action: operator.ReconcileActionUpdated,
		Object: plugin,
	}

	result, err := reconciler.reconcile(context.Background(), req)

	require.NoError(t, err)
	require.Equal(t, operator.ReconcileResult{}, result)
	require.Empty(t, mockReg.registered)
	require.Empty(t, mockReg.unregistered)
	require.Empty(t, mockReg.updatedStatuses)
	require.Equal(t, 1.0, childReconciliationMetricValue(t, childReconciliationStatusSkippedUpToDate, operator.ReconcileActionUpdated, "test-plugin-app"))
	require.Equal(t, 0.0, childReconciliationMetricValue(t, childReconciliationStatusSuccess, operator.ReconcileActionUpdated, "test-plugin-app"))
}

func TestChildPluginReconciler_RecordsSuccessMetric(t *testing.T) {
	resetChildReconciliationMetrics(t)

	mockProv := &mockMetaProvider{
		getMetaFunc: func(ctx context.Context, ref meta.PluginRef) (*meta.Result, error) {
			return &meta.Result{
				Meta: pluginsv0alpha1.MetaSpec{Children: []string{"child-plugin-1"}},
				TTL:  5 * time.Minute,
			}, nil
		},
	}
	metaManager := meta.NewProviderManager(mockProv)

	mockReg := newMockPluginRegistrar()
	reconciler := NewChildPluginReconciler(&logging.NoOpLogger{}, metaManager, mockReg)

	result, err := reconciler.reconcile(context.Background(), operator.TypedReconcileRequest[*pluginsv0alpha1.Plugin]{
		Action: operator.ReconcileActionCreated,
		Object: newTestPlugin("test-plugin-app", "1.0.0"),
	})

	require.NoError(t, err)
	require.Equal(t, operator.ReconcileResult{}, result)
	require.Equal(t, 1.0, childReconciliationMetricValue(t, childReconciliationStatusSuccess, operator.ReconcileActionCreated, "test-plugin-app"))
	require.Equal(t, 0.0, childReconciliationMetricValue(t, childReconciliationStatusError, operator.ReconcileActionCreated, "test-plugin-app"))
	require.Equal(t, 0.0, childReconciliationMetricValue(t, childReconciliationStatusSkippedMetaNotFound, operator.ReconcileActionCreated, "test-plugin-app"))
}

// mockMetaProvider implements meta.Provider for testing
type mockMetaProvider struct {
	getMetaFunc func(ctx context.Context, ref meta.PluginRef) (*meta.Result, error)
}

func (m *mockMetaProvider) Name() string {
	return "mock"
}

func (m *mockMetaProvider) GetMeta(ctx context.Context, ref meta.PluginRef) (*meta.Result, error) {
	if m.getMetaFunc != nil {
		return m.getMetaFunc(ctx, ref)
	}
	return nil, meta.ErrMetaNotFound
}

// mockPluginRegistrar implements Registrar for testing
type mockPluginRegistrar struct {
	registerFunc     func(ctx context.Context, namespace string, install *PluginInstall) error
	unregisterFunc   func(ctx context.Context, namespace string, name string, source Source) error
	getFunc          func(ctx context.Context, namespace string, name string) (*pluginsv0alpha1.Plugin, error)
	updateStatusFunc func(ctx context.Context, plugin *pluginsv0alpha1.Plugin, status pluginsv0alpha1.PluginStatus) error
	registered       map[string]*PluginInstall
	unregistered     map[string]bool
	existing         map[string]*pluginsv0alpha1.Plugin
	updatedStatuses  []pluginsv0alpha1.PluginStatus
}

func newMockPluginRegistrar() *mockPluginRegistrar {
	return &mockPluginRegistrar{
		registered:   make(map[string]*PluginInstall),
		unregistered: make(map[string]bool),
		existing:     make(map[string]*pluginsv0alpha1.Plugin),
	}
}

type mockOwnershipFilter struct {
	ownsFunc func(context.Context, *pluginsv0alpha1.Plugin) (bool, error)
}

func (m mockOwnershipFilter) OwnsPlugin(ctx context.Context, plugin *pluginsv0alpha1.Plugin) (bool, error) {
	if m.ownsFunc != nil {
		return m.ownsFunc(ctx, plugin)
	}
	return true, nil
}

func resetChildReconciliationMetrics(t *testing.T) {
	t.Helper()

	metrics.ChildReconciliationTotal.Reset()
	t.Cleanup(metrics.ChildReconciliationTotal.Reset)
}

func childReconciliationMetricValue(t *testing.T, status string, action operator.ReconcileAction, pluginID string) float64 {
	t.Helper()

	return testutil.ToFloat64(metrics.ChildReconciliationTotal.WithLabelValues(status, actionLabel(action), pluginID))
}

func (m *mockPluginRegistrar) Register(ctx context.Context, namespace string, install *PluginInstall) error {
	if m.registerFunc != nil {
		return m.registerFunc(ctx, namespace, install)
	}
	m.registered[install.ID] = install
	m.existing[install.ID] = install.ToPluginInstallV0Alpha1(namespace)
	return nil
}

func (m *mockPluginRegistrar) Unregister(ctx context.Context, namespace string, name string, source Source) error {
	if m.unregisterFunc != nil {
		return m.unregisterFunc(ctx, namespace, name, source)
	}
	m.unregistered[name] = true
	delete(m.registered, name)
	delete(m.existing, name)
	return nil
}

func (m *mockPluginRegistrar) Get(ctx context.Context, namespace string, name string) (*pluginsv0alpha1.Plugin, error) {
	if m.getFunc != nil {
		return m.getFunc(ctx, namespace, name)
	}
	existing, ok := m.existing[name]
	if !ok {
		return nil, apierrors.NewNotFound(schema.GroupResource{Group: pluginsv0alpha1.APIGroup, Resource: "plugins"}, name)
	}
	return existing, nil
}

func (m *mockPluginRegistrar) UpdateStatus(ctx context.Context, plugin *pluginsv0alpha1.Plugin, status pluginsv0alpha1.PluginStatus) error {
	if m.updateStatusFunc != nil {
		return m.updateStatusFunc(ctx, plugin, status)
	}
	m.updatedStatuses = append(m.updatedStatuses, status)
	return nil
}

func newTestPlugin(name, version string) *pluginsv0alpha1.Plugin {
	return &pluginsv0alpha1.Plugin{
		ObjectMeta: metav1.ObjectMeta{
			Name:            name,
			Namespace:       "default",
			ResourceVersion: "1",
		},
		Spec: pluginsv0alpha1.PluginSpec{
			Id:      name,
			Version: version,
		},
	}
}

func withStoredChildren(plugin *pluginsv0alpha1.Plugin, generation int64, state pluginsv0alpha1.PluginStatusOperatorStateState, children []string) {
	plugin.Status = pluginsv0alpha1.PluginStatus{
		ChildAppliedChildren: normalizeChildren(children),
		ChildObservedGeneration: func(v int64) *int64 {
			return &v
		}(generation),
		OperatorStates: map[string]pluginsv0alpha1.PluginstatusOperatorState{
			childReconcilerStatusKey: {
				State: state,
			},
		},
	}
}

func withLegacyStoredChildren(plugin *pluginsv0alpha1.Plugin, generation int64, state pluginsv0alpha1.PluginStatusOperatorStateState, children []string) {
	plugin.Status = pluginsv0alpha1.PluginStatus{
		OperatorStates: map[string]pluginsv0alpha1.PluginstatusOperatorState{
			childReconcilerStatusKey: {
				State: state,
				Details: map[string]interface{}{
					childStatusObservedGeneration: fmt.Sprintf("%d", generation),
					childStatusAppliedChildren:    normalizeChildren(children),
				},
			},
		},
	}
}

func strPtr(v string) *string {
	return &v
}

// buildChildList returns a slice of n child plugin IDs for use in tests.
func buildChildList(n int) []string {
	children := make([]string, n)
	for i := range children {
		children[i] = fmt.Sprintf("child-plugin-%d", i)
	}
	return children
}
