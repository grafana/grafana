package install

import (
	"context"
	"errors"
	"testing"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
)

// MockInstaller is a mock implementation of plugins.Installer
type MockInstaller struct {
	mock.Mock
}

func (m *MockInstaller) Add(ctx context.Context, pluginID, version string, opts plugins.AddOpts) error {
	args := m.Called(ctx, pluginID, version, opts)
	return args.Error(0)
}

func (m *MockInstaller) Remove(ctx context.Context, pluginID, version string) error {
	args := m.Called(ctx, pluginID, version)
	return args.Error(0)
}

// MockPluginStore is a mock implementation of pluginstore.Store
type MockPluginStore struct {
	mock.Mock
}

func (m *MockPluginStore) Plugin(ctx context.Context, pluginID string) (pluginstore.Plugin, bool) {
	args := m.Called(ctx, pluginID)
	return args.Get(0).(pluginstore.Plugin), args.Bool(1)
}

func (m *MockPluginStore) Plugins(ctx context.Context, pluginTypes ...plugins.Type) []pluginstore.Plugin {
	args := m.Called(ctx, pluginTypes)
	return args.Get(0).([]pluginstore.Plugin)
}

// MockRegistrar is a mock implementation of Registrar
type MockRegistrar struct {
	mock.Mock
}

func (m *MockRegistrar) Register(ctx context.Context, namespace string, install *PluginInstall) error {
	args := m.Called(ctx, namespace, install)
	return args.Error(0)
}

func (m *MockRegistrar) RegisterWithOwner(ctx context.Context, namespace string, install *PluginInstall, parent *pluginsv0alpha1.Plugin) error {
	args := m.Called(ctx, namespace, install, parent)
	return args.Error(0)
}

func (m *MockRegistrar) Unregister(ctx context.Context, namespace string, name string, source Source) error {
	args := m.Called(ctx, namespace, name, source)
	return args.Error(0)
}

func TestLocalManager_Install(t *testing.T) {
	tests := []struct {
		name          string
		plugin        *pluginsv0alpha1.Plugin
		installerErr  error
		expectedError bool
	}{
		{
			name: "successful install without URL",
			plugin: &pluginsv0alpha1.Plugin{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-plugin",
					Namespace: "org-1",
				},
				Spec: pluginsv0alpha1.PluginSpec{
					Id:      "test-plugin",
					Version: "1.0.0",
				},
			},
			installerErr:  nil,
			expectedError: false,
		},
		{
			name: "successful install with URL",
			plugin: &pluginsv0alpha1.Plugin{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-plugin",
					Namespace: "org-1",
				},
				Spec: pluginsv0alpha1.PluginSpec{
					Id:      "test-plugin",
					Version: "1.0.0",
					Url:     strPtr("https://example.com/plugin.zip"),
				},
			},
			installerErr:  nil,
			expectedError: false,
		},
		{
			name: "install failure",
			plugin: &pluginsv0alpha1.Plugin{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-plugin",
					Namespace: "org-1",
				},
				Spec: pluginsv0alpha1.PluginSpec{
					Id:      "test-plugin",
					Version: "1.0.0",
				},
			},
			installerErr:  errors.New("installation failed"),
			expectedError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockInstaller := new(MockInstaller)
			logger := &logging.NoOpLogger{}
			manager := NewLocalManager(mockInstaller, nil, nil, "10.0.0", logger)

			// Set up expectations
			mockInstaller.On("Add", mock.Anything, tt.plugin.Spec.Id, tt.plugin.Spec.Version, mock.Anything).
				Return(tt.installerErr)

			// Execute
			err := manager.Install(context.Background(), tt.plugin)

			// Verify
			if tt.expectedError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
			mockInstaller.AssertExpectations(t)
		})
	}
}

func TestLocalManager_Update(t *testing.T) {
	tests := []struct {
		name          string
		oldPlugin     *pluginsv0alpha1.Plugin
		newPlugin     *pluginsv0alpha1.Plugin
		removeErr     error
		addErr        error
		expectedError bool
		expectRemove  bool
		expectAdd     bool
	}{
		{
			name: "version changed - successful update",
			oldPlugin: &pluginsv0alpha1.Plugin{
				Spec: pluginsv0alpha1.PluginSpec{
					Id:      "test-plugin",
					Version: "1.0.0",
				},
			},
			newPlugin: &pluginsv0alpha1.Plugin{
				Spec: pluginsv0alpha1.PluginSpec{
					Id:      "test-plugin",
					Version: "2.0.0",
				},
			},
			removeErr:     nil,
			addErr:        nil,
			expectedError: false,
			expectRemove:  true,
			expectAdd:     true,
		},
		{
			name: "URL changed - successful update",
			oldPlugin: &pluginsv0alpha1.Plugin{
				Spec: pluginsv0alpha1.PluginSpec{
					Id:      "test-plugin",
					Version: "1.0.0",
				},
			},
			newPlugin: &pluginsv0alpha1.Plugin{
				Spec: pluginsv0alpha1.PluginSpec{
					Id:      "test-plugin",
					Version: "1.0.0",
					Url:     strPtr("https://example.com/new.zip"),
				},
			},
			removeErr:     nil,
			addErr:        nil,
			expectedError: false,
			expectRemove:  true,
			expectAdd:     true,
		},
		{
			name: "no spec changes - no operation",
			oldPlugin: &pluginsv0alpha1.Plugin{
				Spec: pluginsv0alpha1.PluginSpec{
					Id:      "test-plugin",
					Version: "1.0.0",
				},
			},
			newPlugin: &pluginsv0alpha1.Plugin{
				Spec: pluginsv0alpha1.PluginSpec{
					Id:      "test-plugin",
					Version: "1.0.0",
				},
			},
			expectedError: false,
			expectRemove:  false,
			expectAdd:     false,
		},
		{
			name: "remove fails but continues with install",
			oldPlugin: &pluginsv0alpha1.Plugin{
				Spec: pluginsv0alpha1.PluginSpec{
					Id:      "test-plugin",
					Version: "1.0.0",
				},
			},
			newPlugin: &pluginsv0alpha1.Plugin{
				Spec: pluginsv0alpha1.PluginSpec{
					Id:      "test-plugin",
					Version: "2.0.0",
				},
			},
			removeErr:     errors.New("remove failed"),
			addErr:        nil,
			expectedError: false,
			expectRemove:  true,
			expectAdd:     true,
		},
		{
			name: "install fails",
			oldPlugin: &pluginsv0alpha1.Plugin{
				Spec: pluginsv0alpha1.PluginSpec{
					Id:      "test-plugin",
					Version: "1.0.0",
				},
			},
			newPlugin: &pluginsv0alpha1.Plugin{
				Spec: pluginsv0alpha1.PluginSpec{
					Id:      "test-plugin",
					Version: "2.0.0",
				},
			},
			removeErr:     nil,
			addErr:        errors.New("install failed"),
			expectedError: true,
			expectRemove:  true,
			expectAdd:     true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockInstaller := new(MockInstaller)
			logger := &logging.NoOpLogger{}
			manager := NewLocalManager(mockInstaller, nil, nil, "10.0.0", logger)

			// Set up expectations
			if tt.expectRemove {
				mockInstaller.On("Remove", mock.Anything, tt.oldPlugin.Spec.Id, tt.oldPlugin.Spec.Version).
					Return(tt.removeErr)
			}
			if tt.expectAdd {
				mockInstaller.On("Add", mock.Anything, tt.newPlugin.Spec.Id, tt.newPlugin.Spec.Version, mock.Anything).
					Return(tt.addErr)
			}

			// Execute
			err := manager.Update(context.Background(), tt.oldPlugin, tt.newPlugin)

			// Verify
			if tt.expectedError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
			mockInstaller.AssertExpectations(t)
		})
	}
}

func TestLocalManager_Uninstall(t *testing.T) {
	tests := []struct {
		name          string
		plugin        *pluginsv0alpha1.Plugin
		removeErr     error
		expectedError bool
	}{
		{
			name: "successful uninstall",
			plugin: &pluginsv0alpha1.Plugin{
				Spec: pluginsv0alpha1.PluginSpec{
					Id:      "test-plugin",
					Version: "1.0.0",
				},
			},
			removeErr:     nil,
			expectedError: false,
		},
		{
			name: "uninstall failure",
			plugin: &pluginsv0alpha1.Plugin{
				Spec: pluginsv0alpha1.PluginSpec{
					Id:      "test-plugin",
					Version: "1.0.0",
				},
			},
			removeErr:     errors.New("uninstall failed"),
			expectedError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockInstaller := new(MockInstaller)
			logger := &logging.NoOpLogger{}
			manager := NewLocalManager(mockInstaller, nil, nil, "10.0.0", logger)

			// Set up expectations
			mockInstaller.On("Remove", mock.Anything, tt.plugin.Spec.Id, tt.plugin.Spec.Version).
				Return(tt.removeErr)

			// Execute
			err := manager.Uninstall(context.Background(), tt.plugin)

			// Verify
			if tt.expectedError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
			mockInstaller.AssertExpectations(t)
		})
	}
}

func TestLocalManager_Install_WithChildren(t *testing.T) {
	tests := []struct {
		name                string
		plugin              *pluginsv0alpha1.Plugin
		storePlugin         pluginstore.Plugin
		storeExists         bool
		installerErr        error
		expectedRegisterCnt int
		expectError         bool
	}{
		{
			name: "parent with children - registers all children",
			plugin: &pluginsv0alpha1.Plugin{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "parent-plugin",
					Namespace: "org-1",
				},
				Spec: pluginsv0alpha1.PluginSpec{
					Id:      "parent-plugin",
					Version: "1.0.0",
				},
			},
			storePlugin: pluginstore.Plugin{
				Children: []string{"child-1", "child-2"},
			},
			storeExists:         true,
			installerErr:        nil,
			expectedRegisterCnt: 2,
			expectError:         false,
		},
		{
			name: "parent with no children - no registrations",
			plugin: &pluginsv0alpha1.Plugin{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "simple-plugin",
					Namespace: "org-1",
				},
				Spec: pluginsv0alpha1.PluginSpec{
					Id:      "simple-plugin",
					Version: "1.0.0",
				},
			},
			storePlugin: pluginstore.Plugin{
				Children: []string{},
			},
			storeExists:         true,
			installerErr:        nil,
			expectedRegisterCnt: 0,
			expectError:         false,
		},
		{
			name: "plugin not found in store - no registrations but no error",
			plugin: &pluginsv0alpha1.Plugin{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "missing-plugin",
					Namespace: "org-1",
				},
				Spec: pluginsv0alpha1.PluginSpec{
					Id:      "missing-plugin",
					Version: "1.0.0",
				},
			},
			storePlugin:         pluginstore.Plugin{},
			storeExists:         false,
			installerErr:        nil,
			expectedRegisterCnt: 0,
			expectError:         false,
		},
		{
			name: "installer fails - no child registration",
			plugin: &pluginsv0alpha1.Plugin{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "failing-plugin",
					Namespace: "org-1",
				},
				Spec: pluginsv0alpha1.PluginSpec{
					Id:      "failing-plugin",
					Version: "1.0.0",
				},
			},
			storePlugin:         pluginstore.Plugin{},
			storeExists:         false,
			installerErr:        errors.New("installation failed"),
			expectedRegisterCnt: 0,
			expectError:         true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockInstaller := new(MockInstaller)
			mockStore := new(MockPluginStore)
			mockRegistrar := new(MockRegistrar)
			logger := &logging.NoOpLogger{}
			manager := NewLocalManager(mockInstaller, mockStore, mockRegistrar, "10.0.0", logger)

			// Set up installer expectations
			mockInstaller.On("Add", mock.Anything, tt.plugin.Spec.Id, tt.plugin.Spec.Version, mock.Anything).
				Return(tt.installerErr)

			// Set up store expectations only if installer succeeds
			if tt.installerErr == nil {
				mockStore.On("Plugin", mock.Anything, tt.plugin.Spec.Id).
					Return(tt.storePlugin, tt.storeExists)

				// Set up registrar expectations for each child
				for i := 0; i < tt.expectedRegisterCnt; i++ {
					mockRegistrar.On("RegisterWithOwner",
						mock.Anything,
						tt.plugin.Namespace,
						mock.MatchedBy(func(install *PluginInstall) bool {
							return install.Source == SourceChildPluginReconciler &&
								install.Version == tt.plugin.Spec.Version &&
								install.ParentID == tt.plugin.Spec.Id
						}),
						tt.plugin,
					).Return(nil).Once()
				}
			}

			// Execute
			err := manager.Install(context.Background(), tt.plugin)

			// Verify
			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
			mockInstaller.AssertExpectations(t)
			if tt.installerErr == nil {
				mockStore.AssertExpectations(t)
				mockRegistrar.AssertExpectations(t)
			}
		})
	}
}

func TestLocalManager_Update_WithChildren(t *testing.T) {
	oldPlugin := &pluginsv0alpha1.Plugin{
		Spec: pluginsv0alpha1.PluginSpec{
			Id:      "parent-plugin",
			Version: "1.0.0",
		},
	}
	newPlugin := &pluginsv0alpha1.Plugin{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "parent-plugin",
			Namespace: "org-1",
		},
		Spec: pluginsv0alpha1.PluginSpec{
			Id:      "parent-plugin",
			Version: "2.0.0",
		},
	}

	mockInstaller := new(MockInstaller)
	mockStore := new(MockPluginStore)
	mockRegistrar := new(MockRegistrar)
	logger := &logging.NoOpLogger{}
	manager := NewLocalManager(mockInstaller, mockStore, mockRegistrar, "10.0.0", logger)

	// Set up installer expectations
	mockInstaller.On("Remove", mock.Anything, oldPlugin.Spec.Id, oldPlugin.Spec.Version).Return(nil)
	mockInstaller.On("Add", mock.Anything, newPlugin.Spec.Id, newPlugin.Spec.Version, mock.Anything).Return(nil)

	// Set up store expectations
	storePlugin := pluginstore.Plugin{
		Children: []string{"child-1", "child-2"},
	}
	mockStore.On("Plugin", mock.Anything, newPlugin.Spec.Id).Return(storePlugin, true)

	// Set up registrar expectations for children with updated version
	mockRegistrar.On("RegisterWithOwner",
		mock.Anything,
		newPlugin.Namespace,
		mock.MatchedBy(func(install *PluginInstall) bool {
			return install.Source == SourceChildPluginReconciler &&
				install.Version == "2.0.0" && // Should use new version
				install.ParentID == newPlugin.Spec.Id
		}),
		newPlugin,
	).Return(nil).Twice()

	// Execute
	err := manager.Update(context.Background(), oldPlugin, newPlugin)

	// Verify
	assert.NoError(t, err)
	mockInstaller.AssertExpectations(t)
	mockStore.AssertExpectations(t)
	mockRegistrar.AssertExpectations(t)
}

func strPtr(s string) *string {
	return &s
}
