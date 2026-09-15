package installsync

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"testing"
	"testing/synctest"
	"time"

	"github.com/grafana/dskit/backoff"
	sdkK8s "github.com/grafana/grafana-app-sdk/k8s"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/stretchr/testify/require"
	errorsK8s "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
	"github.com/grafana/grafana/apps/plugins/pkg/app/install"
	infraserverlock "github.com/grafana/grafana/pkg/infra/serverlock"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgtest"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
)

func testBackoffConfig(maxRetries int) backoff.Config {
	return backoff.Config{
		MinBackoff: time.Millisecond,
		MaxBackoff: 2 * time.Millisecond,
		MaxRetries: maxRetries,
	}
}

func TestSyncer_syncWithRetry(t *testing.T) {
	t.Run("succeeds without retrying when the first attempt succeeds", func(t *testing.T) {
		s := newSyncer(nil, nil, nil, nil, nil, nil, nil)
		s.backoffConfig = testBackoffConfig(3)

		var calls int
		s.syncWithRetry(t.Context(), func(context.Context) error {
			calls++
			return nil
		})

		require.Equal(t, 1, calls)
	})

	t.Run("retries after a failure and stops once an attempt succeeds", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			s := newSyncer(nil, nil, nil, nil, nil, nil, nil)
			s.backoffConfig = testBackoffConfig(5)

			var calls int
			s.syncWithRetry(t.Context(), func(context.Context) error {
				calls++
				if calls < 3 {
					return errorsK8s.NewTooManyRequests("throttled", 5)
				}
				return nil
			})

			require.Equal(t, 3, calls)
		})
	})

	t.Run("retries a request deadline while the retry context remains active", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			s := newSyncer(nil, nil, nil, nil, nil, nil, nil)
			s.backoffConfig = testBackoffConfig(3)

			var calls int
			s.syncWithRetry(t.Context(), func(context.Context) error {
				calls++
				if calls == 1 {
					return context.DeadlineExceeded
				}
				return nil
			})

			require.Equal(t, 2, calls)
		})
	})

	t.Run("gives up after the configured number of retries", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			s := newSyncer(nil, nil, nil, nil, nil, nil, nil)
			s.backoffConfig = testBackoffConfig(2)

			var calls int
			s.syncWithRetry(t.Context(), func(context.Context) error {
				calls++
				return errorsK8s.NewTooManyRequests("still throttled", 5)
			})

			// dskit/backoff counts retries after the initial attempt, so
			// MaxRetries=2 allows 1 initial try + 2 retries = 3 calls.
			require.Equal(t, 3, calls)
		})
	})

	t.Run("stops promptly when the context is cancelled mid-retry", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			ctx, cancel := context.WithCancel(t.Context())
			time.AfterFunc(5*time.Millisecond, cancel)
			s := newSyncer(nil, nil, nil, nil, nil, nil, nil)
			s.backoffConfig = backoff.Config{MinBackoff: 10 * time.Millisecond, MaxBackoff: 10 * time.Millisecond, MaxRetries: 0}

			var calls int
			s.syncWithRetry(ctx, func(context.Context) error {
				calls++
				return errorsK8s.NewTooManyRequests("throttled", 5)
			})

			require.Equal(t, 2, calls)
		})
	})

	t.Run("stops immediately without retrying on a non-retryable error", func(t *testing.T) {
		s := newSyncer(nil, nil, nil, nil, nil, nil, nil)
		s.backoffConfig = testBackoffConfig(3)

		var calls int
		s.syncWithRetry(t.Context(), func(context.Context) error {
			calls++
			return errorsK8s.NewBadRequest("malformed plugin install")
		})

		require.Equal(t, 1, calls)
	})

	t.Run("stops immediately without retrying an unknown error", func(t *testing.T) {
		s := newSyncer(nil, nil, nil, nil, nil, nil, nil)
		s.backoffConfig = testBackoffConfig(3)

		var calls int
		s.syncWithRetry(t.Context(), func(context.Context) error {
			calls++
			return errors.New("unknown failure")
		})

		require.Equal(t, 1, calls)
	})

	t.Run("stops immediately when another instance holds the sync lock", func(t *testing.T) {
		s := newSyncer(nil, nil, nil, nil, nil, nil, nil)
		s.backoffConfig = testBackoffConfig(3)

		var calls int
		s.syncWithRetry(t.Context(), func(context.Context) error {
			calls++
			return &infraserverlock.ServerLockExistsError{}
		})

		require.Equal(t, 1, calls)
	})
}

func TestIsRetryableSyncError(t *testing.T) {
	tests := []struct {
		name        string
		err         error
		isRetryable bool
	}{
		{name: "nil error", err: nil, isRetryable: false},
		{name: "generic error", err: errors.New("connection refused"), isRetryable: false},
		{name: "context canceled", err: context.Canceled, isRetryable: false},
		{name: "context deadline exceeded", err: context.DeadlineExceeded, isRetryable: true},
		{name: "too many requests", err: errorsK8s.NewTooManyRequests("throttled", 5), isRetryable: true},
		{name: "service unavailable", err: errorsK8s.NewServiceUnavailable("unavailable"), isRetryable: true},
		{name: "server timeout", err: errorsK8s.NewServerTimeout(schema.GroupResource{}, "list", 5), isRetryable: true},
		{name: "timeout", err: errorsK8s.NewTimeoutError("timeout", 5), isRetryable: true},
		{name: "network timeout", err: &net.DNSError{Err: "timeout", IsTimeout: true}, isRetryable: true},
		{name: "network operation", err: &net.OpError{Op: "read", Err: errors.New("connection refused")}, isRetryable: true},
		{name: "bad request", err: errorsK8s.NewBadRequest("bad request"), isRetryable: false},
		{name: "unauthorized", err: errorsK8s.NewUnauthorized("unauthorized"), isRetryable: false},
		{name: "forbidden", err: errorsK8s.NewForbidden(schema.GroupResource{}, "plugin-1", errors.New("denied")), isRetryable: false},
		{name: "invalid", err: errorsK8s.NewInvalid(schema.GroupKind{}, "plugin-1", nil), isRetryable: false},
		{name: "app SDK forbidden", err: sdkK8s.NewServerResponseError(errors.New("denied"), http.StatusForbidden), isRetryable: false},
		{name: "app SDK forbidden overrides wrapped network error", err: sdkK8s.NewServerResponseError(&net.OpError{Op: "read", Err: errors.New("connection refused")}, http.StatusForbidden), isRetryable: false},
		{name: "wrapped app SDK forbidden overrides wrapped network error", err: fmt.Errorf("update plugin: %w", sdkK8s.NewServerResponseError(&net.OpError{Op: "read", Err: errors.New("connection refused")}, http.StatusForbidden)), isRetryable: false},
		{name: "app SDK too many requests", err: sdkK8s.NewServerResponseError(errors.New("throttled"), http.StatusTooManyRequests), isRetryable: true},
		{name: "app SDK bad gateway", err: sdkK8s.NewServerResponseError(errors.New("bad gateway"), http.StatusBadGateway), isRetryable: true},
		{name: "app SDK gateway timeout", err: sdkK8s.NewServerResponseError(errors.New("gateway timeout"), http.StatusGatewayTimeout), isRetryable: true},
		{name: "app SDK transport failure", err: sdkK8s.ParseKubernetesError(nil, 0, &net.OpError{Op: "read", Err: errors.New("connection refused")}), isRetryable: true},
		{name: "app SDK request deadline", err: sdkK8s.ParseKubernetesError(nil, 0, context.DeadlineExceeded), isRetryable: true},
		{name: "wrapped too many requests", err: fmt.Errorf("list plugins: %w", errorsK8s.NewTooManyRequests("throttled", 5)), isRetryable: true},
		{name: "non-converging sync", err: fmt.Errorf("namespace: %w", install.ErrSyncDidNotConverge), isRetryable: false},
		{name: "non-converging sync overrides a joined retryable error", err: errors.Join(install.ErrSyncDidNotConverge, errorsK8s.NewTooManyRequests("throttled", 5)), isRetryable: false},
		{name: "joined non-retryable errors", err: errors.Join(errorsK8s.NewBadRequest("bad request"), errorsK8s.NewUnauthorized("unauthorized")), isRetryable: false},
		{name: "non-retryable then retryable joined errors", err: errors.Join(errorsK8s.NewForbidden(schema.GroupResource{}, "plugin-1", errors.New("denied")), errorsK8s.NewTooManyRequests("throttled", 5)), isRetryable: true},
		{name: "retryable then non-retryable joined errors", err: errors.Join(errorsK8s.NewTooManyRequests("throttled", 5), errorsK8s.NewForbidden(schema.GroupResource{}, "plugin-1", errors.New("denied"))), isRetryable: true},
		{name: "wrapped joined errors", err: fmt.Errorf("sync namespaces: %w", errors.Join(errorsK8s.NewForbidden(schema.GroupResource{}, "plugin-1", errors.New("denied")), errorsK8s.NewTooManyRequests("throttled", 5))), isRetryable: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.isRetryable, isRetryableSyncError(tt.err))
		})
	}
}

func TestSyncer_Sync(t *testing.T) {
	tests := []struct {
		name                        string
		pluginInstallAPISyncEnabled bool
		pluginStoreServiceEnabled   bool
		installedPlugins            []pluginstore.Plugin
		orgs                        []*org.OrgDTO
		orgServiceError             error
		serverLockError             error
		expectedError               error
		expectSyncCalls             int
	}{
		{
			name:                        "plugin install API sync feature toggle disabled",
			pluginInstallAPISyncEnabled: false,
			pluginStoreServiceEnabled:   true,
			installedPlugins:            []pluginstore.Plugin{{JSONData: plugins.JSONData{ID: "test-plugin"}, Class: plugins.ClassCore}},
			orgs:                        []*org.OrgDTO{{ID: 1, Name: "Org 1"}},
			expectedError:               nil,
			expectSyncCalls:             0,
		},
		{
			name:                        "plugin store service feature toggle disabled",
			pluginInstallAPISyncEnabled: true,
			pluginStoreServiceEnabled:   false,
			installedPlugins:            []pluginstore.Plugin{{JSONData: plugins.JSONData{ID: "test-plugin"}, Class: plugins.ClassCore}},
			orgs:                        []*org.OrgDTO{{ID: 1, Name: "Org 1"}},
			expectedError:               nil,
			expectSyncCalls:             0,
		},
		{
			name:                        "both feature toggles enabled, no orgs",
			pluginInstallAPISyncEnabled: true,
			pluginStoreServiceEnabled:   true,
			installedPlugins:            []pluginstore.Plugin{{JSONData: plugins.JSONData{ID: "test-plugin"}, Class: plugins.ClassCore}},
			orgs:                        []*org.OrgDTO{},
			expectedError:               nil,
			expectSyncCalls:             0,
		},
		{
			name:                        "both feature toggles enabled, empty installed plugins",
			pluginInstallAPISyncEnabled: true,
			pluginStoreServiceEnabled:   true,
			installedPlugins:            []pluginstore.Plugin{},
			orgs:                        []*org.OrgDTO{{ID: 1, Name: "Org 1"}},
			expectedError:               nil,
			expectSyncCalls:             0,
		},
		{
			name:                        "both feature toggles enabled, single org",
			pluginInstallAPISyncEnabled: true,
			pluginStoreServiceEnabled:   true,
			installedPlugins:            []pluginstore.Plugin{{JSONData: plugins.JSONData{ID: "test-plugin"}, Class: plugins.ClassCore}},
			orgs:                        []*org.OrgDTO{{ID: 1, Name: "Org 1"}},
			expectedError:               nil,
			expectSyncCalls:             1,
		},
		{
			name:                        "both feature toggles enabled, multiple orgs",
			pluginInstallAPISyncEnabled: true,
			pluginStoreServiceEnabled:   true,
			installedPlugins:            []pluginstore.Plugin{{JSONData: plugins.JSONData{ID: "test-plugin"}, Class: plugins.ClassCore}},
			orgs: []*org.OrgDTO{
				{ID: 1, Name: "Org 1"},
				{ID: 2, Name: "Org 2"},
				{ID: 3, Name: "Org 3"},
			},
			expectedError:   nil,
			expectSyncCalls: 3,
		},
		{
			name:                        "org service error",
			pluginInstallAPISyncEnabled: true,
			pluginStoreServiceEnabled:   true,
			installedPlugins:            []pluginstore.Plugin{{JSONData: plugins.JSONData{ID: "test-plugin"}, Class: plugins.ClassCore}},
			orgs:                        nil,
			orgServiceError:             errors.New("org service error"),
			expectedError:               errors.New("org service error"),
			expectSyncCalls:             0,
		},
		{
			name:                        "server lock error",
			pluginInstallAPISyncEnabled: true,
			pluginStoreServiceEnabled:   true,
			installedPlugins:            []pluginstore.Plugin{{JSONData: plugins.JSONData{ID: "test-plugin"}, Class: plugins.ClassCore}},
			orgs:                        []*org.OrgDTO{{ID: 1, Name: "Org 1"}},
			serverLockError:             errors.New("lock error"),
			expectedError:               errors.New("lock error"),
			expectSyncCalls:             0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()

			// Setup feature toggles
			ft := featuremgmt.NewMockFeatureToggles(t)
			ft.EXPECT().IsEnabled(ctx, featuremgmt.FlagPluginInstallAPISync).Return(tt.pluginInstallAPISyncEnabled).Maybe()
			ft.EXPECT().IsEnabled(ctx, featuremgmt.FlagPluginStoreServiceLoading).Return(tt.pluginStoreServiceEnabled).Maybe()

			// Setup org service
			orgService := orgtest.NewOrgServiceFake()
			orgService.ExpectedOrgs = tt.orgs
			orgService.ExpectedError = tt.orgServiceError

			// Setup server lock
			serverLock := &fakeServerLock{}
			if tt.serverLockError != nil {
				serverLock.lockFunc = func(ctx context.Context, actionName string, maxInterval time.Duration, fn func(ctx context.Context)) error {
					return tt.serverLockError
				}
			}

			// Setup stateful fake client so the sync's convergence pass sees its own writes
			syncCalls := 0
			stateByNamespace := map[string][]pluginsv0alpha1.Plugin{}
			fakeClient := &fakePluginInstallClient{
				createFunc: func(ctx context.Context, obj *pluginsv0alpha1.Plugin, opts resource.CreateOptions) (*pluginsv0alpha1.Plugin, error) {
					syncCalls++
					stateByNamespace[obj.Namespace] = append(stateByNamespace[obj.Namespace], *obj)
					return obj, nil
				},
				listAllFunc: func(ctx context.Context, namespace string, opts resource.ListOptions) (*pluginsv0alpha1.PluginList, error) {
					return &pluginsv0alpha1.PluginList{Items: stateByNamespace[namespace]}, nil
				},
			}
			clientGen := &fakeClientGenerator{client: fakeClient}
			registrar := install.NewInstallRegistrar(&logging.NoOpLogger{}, clientGen)

			// Create syncer
			s := newSyncer(
				ft,
				registrar,
				orgService,
				func(orgID int64) string { return fmt.Sprintf("org-%d", orgID) },
				serverLock,
				nil,
				nil,
			)

			// Execute
			err := s.Sync(ctx, install.SourcePluginStore, tt.installedPlugins)

			// Verify
			if tt.expectedError != nil {
				require.Error(t, err)
				require.Equal(t, tt.expectedError.Error(), err.Error())
			} else {
				require.NoError(t, err)
			}

			require.Equal(t, tt.expectSyncCalls, syncCalls)
		})
	}
}

func TestSyncer_syncNamespace(t *testing.T) {
	tests := []struct {
		name               string
		installedPlugins   []pluginstore.Plugin
		apiPlugins         []pluginsv0alpha1.Plugin
		clientListError    error
		expectedError      error
		expectedRegCalls   int
		expectedUnregCalls int
		registeredIDs      []string
		unregisteredIDs    []string
		updatedIDs         []string
	}{
		{
			name:               "no installed plugins, no API plugins",
			installedPlugins:   []pluginstore.Plugin{},
			apiPlugins:         []pluginsv0alpha1.Plugin{},
			expectedError:      nil,
			expectedRegCalls:   0,
			expectedUnregCalls: 0,
		},
		{
			name: "installed plugins only",
			installedPlugins: []pluginstore.Plugin{
				{JSONData: plugins.JSONData{ID: "plugin-1", Info: plugins.Info{Version: "1.0.0"}}, Class: plugins.ClassCore},
				{JSONData: plugins.JSONData{ID: "plugin-2", Info: plugins.Info{Version: "2.0.0"}}, Class: plugins.ClassExternal},
			},
			apiPlugins:         []pluginsv0alpha1.Plugin{},
			expectedError:      nil,
			expectedRegCalls:   2,
			expectedUnregCalls: 0,
			registeredIDs:      []string{"plugin-1", "plugin-2"},
		},
		{
			name: "child plugins are ignored",
			installedPlugins: []pluginstore.Plugin{
				{
					JSONData: plugins.JSONData{ID: "parent-plugin", Info: plugins.Info{Version: "1.0.0"}},
					Class:    plugins.ClassExternal,
				},
				{
					JSONData:        plugins.JSONData{ID: "child-plugin", Info: plugins.Info{Version: "1.0.0"}},
					Class:           plugins.ClassExternal,
					IncludedInAppID: "parent-plugin",
				},
			},
			apiPlugins: []pluginsv0alpha1.Plugin{
				{
					ObjectMeta: metav1.ObjectMeta{
						Name: "child-plugin",
						Annotations: map[string]string{
							install.PluginInstallSourceAnnotation: install.SourcePluginStore,
						},
					},
					Spec: pluginsv0alpha1.PluginSpec{Id: "child-plugin"},
				},
			},
			expectedError:      nil,
			expectedRegCalls:   1,
			expectedUnregCalls: 1,
			registeredIDs:      []string{"parent-plugin"},
			unregisteredIDs:    []string{"child-plugin"},
		},
		{
			name: "directly installed dependency plugin is registered",
			installedPlugins: []pluginstore.Plugin{
				{
					JSONData: plugins.JSONData{
						ID:   "parent-datasource",
						Type: plugins.TypeDataSource,
						Info: plugins.Info{Version: "1.0.0"},
						Dependencies: plugins.Dependencies{
							Plugins: []plugins.Dependency{{ID: "dependency-panel"}},
						},
					},
					Class: plugins.ClassExternal,
				},
				{
					JSONData: plugins.JSONData{ID: "dependency-panel", Info: plugins.Info{Version: "2.0.0"}},
					Class:    plugins.ClassExternal,
				},
			},
			apiPlugins: []pluginsv0alpha1.Plugin{
				{
					ObjectMeta: metav1.ObjectMeta{
						Name: "parent-datasource",
						Annotations: map[string]string{
							install.PluginInstallSourceAnnotation: install.SourcePluginStore,
						},
					},
					Spec: pluginsv0alpha1.PluginSpec{Id: "parent-datasource", Version: "1.0.0"},
				},
			},
			expectedError:      nil,
			expectedRegCalls:   1,
			expectedUnregCalls: 0,
			registeredIDs:      []string{"dependency-panel"},
			// the parent's applied-dependencies annotation is missing, so the
			// sync updates the parent to trigger dependency reconciliation
			updatedIDs: []string{"parent-datasource"},
		},
		{
			name:             "API plugins only",
			installedPlugins: []pluginstore.Plugin{},
			apiPlugins: []pluginsv0alpha1.Plugin{
				{
					ObjectMeta: metav1.ObjectMeta{
						Name: "plugin-1",
						Annotations: map[string]string{
							install.PluginInstallSourceAnnotation: install.SourcePluginStore,
						},
					},
					Spec: pluginsv0alpha1.PluginSpec{Id: "plugin-1"},
				},
				{
					ObjectMeta: metav1.ObjectMeta{
						Name: "plugin-2",
						Annotations: map[string]string{
							install.PluginInstallSourceAnnotation: install.SourcePluginStore,
						},
					},
					Spec: pluginsv0alpha1.PluginSpec{Id: "plugin-2"},
				},
			},
			expectedError:      nil,
			expectedRegCalls:   0,
			expectedUnregCalls: 2,
			unregisteredIDs:    []string{"plugin-1", "plugin-2"},
		},
		{
			name: "mixed - some match",
			installedPlugins: []pluginstore.Plugin{
				{JSONData: plugins.JSONData{ID: "plugin-1", Info: plugins.Info{Version: "1.0.0"}}, Class: plugins.ClassCore},
				{JSONData: plugins.JSONData{ID: "plugin-2", Info: plugins.Info{Version: "2.0.0"}}, Class: plugins.ClassExternal},
				{JSONData: plugins.JSONData{ID: "plugin-3", Info: plugins.Info{Version: "3.0.0"}}, Class: plugins.ClassExternal},
			},
			apiPlugins: []pluginsv0alpha1.Plugin{
				{
					ObjectMeta: metav1.ObjectMeta{
						Name: "plugin-2",
						Annotations: map[string]string{
							install.PluginInstallSourceAnnotation: install.SourcePluginStore,
						},
					},
					Spec: pluginsv0alpha1.PluginSpec{Id: "plugin-2", Version: "2.0.0"},
				},
				{
					ObjectMeta: metav1.ObjectMeta{
						Name: "plugin-4",
						Annotations: map[string]string{
							install.PluginInstallSourceAnnotation: install.SourcePluginStore,
						},
					},
					Spec: pluginsv0alpha1.PluginSpec{Id: "plugin-4"},
				},
			},
			expectedError:      nil,
			expectedRegCalls:   2, // plugin-1 and plugin-3 are new, plugin-2 already exists
			expectedUnregCalls: 1, // plugin-4 removed
			registeredIDs:      []string{"plugin-1", "plugin-3"},
			unregisteredIDs:    []string{"plugin-4"},
		},
		{
			name:             "list error",
			installedPlugins: []pluginstore.Plugin{},
			apiPlugins:       []pluginsv0alpha1.Plugin{},
			clientListError:  errors.New("list error"),
			expectedError:    errors.New("list error"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()

			// Track calls
			var registeredIDs []string
			var unregisteredIDs []string
			var updatedIDs []string

			// Setup stateful fake client so the sync's convergence pass sees its own writes
			state := make([]pluginsv0alpha1.Plugin, 0, len(tt.apiPlugins))
			for i := range tt.apiPlugins {
				state = append(state, *tt.apiPlugins[i].DeepCopy())
			}
			fakeClient := &fakePluginInstallClient{
				listAllFunc: func(ctx context.Context, namespace string, opts resource.ListOptions) (*pluginsv0alpha1.PluginList, error) {
					if tt.clientListError != nil {
						return nil, tt.clientListError
					}
					items := make([]pluginsv0alpha1.Plugin, len(state))
					copy(items, state)
					return &pluginsv0alpha1.PluginList{Items: items}, nil
				},
				createFunc: func(ctx context.Context, obj *pluginsv0alpha1.Plugin, opts resource.CreateOptions) (*pluginsv0alpha1.Plugin, error) {
					registeredIDs = append(registeredIDs, obj.Spec.Id)
					state = append(state, *obj)
					return obj, nil
				},
				updateFunc: func(ctx context.Context, obj *pluginsv0alpha1.Plugin, opts resource.UpdateOptions) (*pluginsv0alpha1.Plugin, error) {
					updatedIDs = append(updatedIDs, obj.Spec.Id)
					for i := range state {
						if state[i].Name == obj.Name {
							state[i] = *obj
							break
						}
					}
					return obj, nil
				},
				deleteFunc: func(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
					unregisteredIDs = append(unregisteredIDs, identifier.Name)
					for i := range state {
						if state[i].Name == identifier.Name {
							state = append(state[:i], state[i+1:]...)
							break
						}
					}
					return nil
				},
				getFunc: func(ctx context.Context, identifier resource.Identifier) (*pluginsv0alpha1.Plugin, error) {
					for i := range state {
						if state[i].Name == identifier.Name {
							return state[i].DeepCopy(), nil
						}
					}
					return nil, errorsK8s.NewNotFound(schema.GroupResource{
						Group:    pluginsv0alpha1.APIGroup,
						Resource: "plugininstalls",
					}, identifier.Name)
				},
			}

			clientGen := &fakeClientGenerator{client: fakeClient}
			registrar := install.NewInstallRegistrar(&logging.NoOpLogger{}, clientGen)

			// Create syncer
			s := newSyncer(
				featuremgmt.NewMockFeatureToggles(t),
				registrar,
				orgtest.NewOrgServiceFake(),
				func(orgID int64) string { return "org-1" },
				&fakeServerLock{},
				nil,
				nil,
			)

			// Execute
			err := s.syncNamespace(ctx, "org-1", install.SourcePluginStore, tt.installedPlugins)

			// Verify
			if tt.expectedError != nil {
				require.Error(t, err)
				require.Contains(t, err.Error(), tt.expectedError.Error())
			} else {
				require.NoError(t, err)
			}

			if tt.expectedRegCalls > 0 {
				require.Len(t, registeredIDs, tt.expectedRegCalls)
				if tt.registeredIDs != nil {
					require.ElementsMatch(t, tt.registeredIDs, registeredIDs)
				}
			}

			if tt.expectedUnregCalls > 0 {
				require.Len(t, unregisteredIDs, tt.expectedUnregCalls)
				if tt.unregisteredIDs != nil {
					require.ElementsMatch(t, tt.unregisteredIDs, unregisteredIDs)
				}
			}

			require.ElementsMatch(t, tt.updatedIDs, updatedIDs)
		})
	}
}

func TestSyncer_syncAllNamespaces_ContinuesAfterNamespaceError(t *testing.T) {
	ctx := context.Background()

	var listedNamespaces []string
	fakeClient := &fakePluginInstallClient{
		listAllFunc: func(_ context.Context, namespace string, _ resource.ListOptions) (*pluginsv0alpha1.PluginList, error) {
			listedNamespaces = append(listedNamespaces, namespace)
			if namespace == "org-1" {
				return nil, errors.New("list failed")
			}
			return &pluginsv0alpha1.PluginList{Items: []pluginsv0alpha1.Plugin{{
				ObjectMeta: metav1.ObjectMeta{
					Namespace:   namespace,
					Name:        "plugin-1",
					Annotations: map[string]string{install.PluginInstallSourceAnnotation: install.SourcePluginStore},
				},
				Spec: pluginsv0alpha1.PluginSpec{Id: "plugin-1", Version: "1.0.0"},
			}}}, nil
		},
	}
	clientGen := &fakeClientGenerator{client: fakeClient}
	orgService := orgtest.NewOrgServiceFake()
	orgService.ExpectedOrgs = []*org.OrgDTO{{ID: 1}, {ID: 2}}

	s := newSyncer(
		featuremgmt.NewMockFeatureToggles(t),
		install.NewInstallRegistrar(&logging.NoOpLogger{}, clientGen),
		orgService,
		func(orgID int64) string { return fmt.Sprintf("org-%d", orgID) },
		&fakeServerLock{},
		nil,
		nil,
	)

	err := s.syncAllNamespaces(ctx, install.SourcePluginStore, []pluginstore.Plugin{
		{JSONData: plugins.JSONData{ID: "plugin-1", Info: plugins.Info{Version: "1.0.0"}}, Class: plugins.ClassCore},
	})
	require.ErrorContains(t, err, `sync namespace "org-1"`)
	require.Equal(t, []string{"org-1", "org-2"}, listedNamespaces)
}

func TestInstallRegistrar_GetClient(t *testing.T) {
	tests := []struct {
		name string
	}{
		{
			name: "first call success and subsequent calls return cached client",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fakeClient := &fakePluginInstallClient{}
			clientGen := &fakeClientGenerator{client: fakeClient}

			s := newSyncer(
				featuremgmt.NewMockFeatureToggles(t),
				install.NewInstallRegistrar(&logging.NoOpLogger{}, clientGen),
				orgtest.NewOrgServiceFake(),
				func(orgID int64) string { return "org-1" },
				&fakeServerLock{},
				nil,
				nil,
			)

			// First call
			client1, err1 := s.installRegistrar.GetClient()
			require.NoError(t, err1)
			require.NotNil(t, client1)

			// Second call should return cached client
			client2, err2 := s.installRegistrar.GetClient()
			require.NoError(t, err2)
			require.NotNil(t, client2)
			// Both calls should return the same client instance
			require.Equal(t, client1, client2)
		})
	}
}

// Test helpers to avoid import cycles
type fakeServerLock struct {
	lockFunc func(ctx context.Context, actionName string, maxInterval time.Duration, fn func(ctx context.Context)) error
}

func (f *fakeServerLock) LockExecuteAndRelease(ctx context.Context, actionName string, maxInterval time.Duration, fn func(ctx context.Context)) error {
	if f.lockFunc != nil {
		return f.lockFunc(ctx, actionName, maxInterval, fn)
	}
	fn(ctx)
	return nil
}

type fakePluginInstallClient struct {
	listAllFunc func(ctx context.Context, namespace string, opts resource.ListOptions) (*pluginsv0alpha1.PluginList, error)
	getFunc     func(ctx context.Context, identifier resource.Identifier) (*pluginsv0alpha1.Plugin, error)
	createFunc  func(ctx context.Context, obj *pluginsv0alpha1.Plugin, opts resource.CreateOptions) (*pluginsv0alpha1.Plugin, error)
	updateFunc  func(ctx context.Context, obj *pluginsv0alpha1.Plugin, opts resource.UpdateOptions) (*pluginsv0alpha1.Plugin, error)
	deleteFunc  func(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error
}

func (f *fakePluginInstallClient) Get(ctx context.Context, identifier resource.Identifier) (*pluginsv0alpha1.Plugin, error) {
	if f.getFunc != nil {
		return f.getFunc(ctx, identifier)
	}
	// Return a proper k8s NotFound error
	return nil, errorsK8s.NewNotFound(schema.GroupResource{
		Group:    pluginsv0alpha1.APIGroup,
		Resource: "plugininstalls",
	}, identifier.Name)
}

func (f *fakePluginInstallClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*pluginsv0alpha1.PluginList, error) {
	if f.listAllFunc != nil {
		return f.listAllFunc(ctx, namespace, opts)
	}
	return &pluginsv0alpha1.PluginList{}, nil
}

func (f *fakePluginInstallClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*pluginsv0alpha1.PluginList, error) {
	return f.ListAll(ctx, namespace, opts)
}

func (f *fakePluginInstallClient) Create(ctx context.Context, obj *pluginsv0alpha1.Plugin, opts resource.CreateOptions) (*pluginsv0alpha1.Plugin, error) {
	if f.createFunc != nil {
		return f.createFunc(ctx, obj, opts)
	}
	return obj, nil
}

func (f *fakePluginInstallClient) Update(ctx context.Context, obj *pluginsv0alpha1.Plugin, opts resource.UpdateOptions) (*pluginsv0alpha1.Plugin, error) {
	if f.updateFunc != nil {
		return f.updateFunc(ctx, obj, opts)
	}
	return obj, nil
}

func (f *fakePluginInstallClient) UpdateStatus(ctx context.Context, identifier resource.Identifier, newStatus pluginsv0alpha1.PluginStatus, opts resource.UpdateOptions) (*pluginsv0alpha1.Plugin, error) {
	return nil, nil
}

func (f *fakePluginInstallClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*pluginsv0alpha1.Plugin, error) {
	return nil, nil
}

func (f *fakePluginInstallClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	if f.deleteFunc != nil {
		return f.deleteFunc(ctx, identifier, opts)
	}
	return nil
}

type fakeClientGenerator struct {
	client *fakePluginInstallClient
}

func (f *fakeClientGenerator) ClientFor(kind resource.Kind) (resource.Client, error) {
	return &fakeResourceClient{client: f.client}, nil
}

func (f *fakeClientGenerator) GetCustomRouteClient(schema.GroupVersion, string) (resource.CustomRouteClient, error) {
	return nil, nil
}

func (f *fakeClientGenerator) DiscoveryClient() (resource.DiscoveryClient, error) {
	return nil, nil
}

type fakeResourceClient struct {
	client *fakePluginInstallClient
}

func (f *fakeResourceClient) Get(ctx context.Context, identifier resource.Identifier) (resource.Object, error) {
	return f.client.Get(ctx, identifier)
}

func (f *fakeResourceClient) GetInto(ctx context.Context, identifier resource.Identifier, into resource.Object) error {
	obj, err := f.client.Get(ctx, identifier)
	if err != nil {
		return err
	}
	// Copy the object data into the provided 'into' object
	if target, ok := into.(*pluginsv0alpha1.Plugin); ok {
		*target = *obj
	}
	return nil
}

func (f *fakeResourceClient) List(ctx context.Context, namespace string, options resource.ListOptions) (resource.ListObject, error) {
	return f.client.ListAll(ctx, namespace, options)
}

func (f *fakeResourceClient) ListInto(ctx context.Context, namespace string, options resource.ListOptions, into resource.ListObject) error {
	list, err := f.client.ListAll(ctx, namespace, options)
	if err != nil {
		return err
	}
	// Copy the list data into the provided 'into' object
	if target, ok := into.(*pluginsv0alpha1.PluginList); ok {
		*target = *list
	}
	return nil
}

func (f *fakeResourceClient) Create(ctx context.Context, identifier resource.Identifier, obj resource.Object, options resource.CreateOptions) (resource.Object, error) {
	plugin := obj.(*pluginsv0alpha1.Plugin)
	return f.client.Create(ctx, plugin, options)
}

func (f *fakeResourceClient) CreateInto(ctx context.Context, identifier resource.Identifier, obj resource.Object, options resource.CreateOptions, into resource.Object) error {
	created, err := f.Create(ctx, identifier, obj, options)
	if err != nil {
		return err
	}
	// Copy the created object data into the provided 'into' object
	if plugin, ok := created.(*pluginsv0alpha1.Plugin); ok {
		if target, ok := into.(*pluginsv0alpha1.Plugin); ok {
			*target = *plugin
		}
	}
	return nil
}

func (f *fakeResourceClient) Update(ctx context.Context, identifier resource.Identifier, obj resource.Object, options resource.UpdateOptions) (resource.Object, error) {
	plugin := obj.(*pluginsv0alpha1.Plugin)
	return f.client.Update(ctx, plugin, options)
}

func (f *fakeResourceClient) UpdateInto(ctx context.Context, identifier resource.Identifier, obj resource.Object, options resource.UpdateOptions, into resource.Object) error {
	updated, err := f.Update(ctx, identifier, obj, options)
	if err != nil {
		return err
	}
	// Copy the updated object data into the provided 'into' object
	if plugin, ok := updated.(*pluginsv0alpha1.Plugin); ok {
		if target, ok := into.(*pluginsv0alpha1.Plugin); ok {
			*target = *plugin
		}
	}
	return nil
}

func (f *fakeResourceClient) Patch(ctx context.Context, identifier resource.Identifier, patch resource.PatchRequest, options resource.PatchOptions) (resource.Object, error) {
	return f.client.Patch(ctx, identifier, patch, options)
}

func (f *fakeResourceClient) PatchInto(ctx context.Context, identifier resource.Identifier, patch resource.PatchRequest, options resource.PatchOptions, into resource.Object) error {
	patched, err := f.Patch(ctx, identifier, patch, options)
	if err != nil {
		return err
	}
	// Copy the patched object data into the provided 'into' object
	if plugin, ok := patched.(*pluginsv0alpha1.Plugin); ok {
		if target, ok := into.(*pluginsv0alpha1.Plugin); ok {
			*target = *plugin
		}
	}
	return nil
}

func (f *fakeResourceClient) Delete(ctx context.Context, identifier resource.Identifier, options resource.DeleteOptions) error {
	return f.client.Delete(ctx, identifier, options)
}

func (f *fakeResourceClient) SubresourceRequest(ctx context.Context, identifier resource.Identifier, req resource.CustomRouteRequestOptions) ([]byte, error) {
	return []byte{}, nil
}

func (f *fakeResourceClient) Watch(ctx context.Context, namespace string, options resource.WatchOptions) (resource.WatchResponse, error) {
	return &fakeWatchResponse{}, nil
}

type fakeWatchResponse struct{}

func (f *fakeWatchResponse) Stop() {}

func (f *fakeWatchResponse) WatchEvents() <-chan resource.WatchEvent {
	ch := make(chan resource.WatchEvent)
	close(ch)
	return ch
}
