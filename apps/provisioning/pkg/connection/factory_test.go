package connection_test

import (
	"context"
	"errors"
	"testing"

	"k8s.io/apimachinery/pkg/runtime"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestProvideFactory(t *testing.T) {
	tests := []struct {
		name          string
		setupExtras   func(t *testing.T) []connection.Extra
		enabled       map[provisioning.ConnectionType]struct{}
		wantErr       bool
		validateError func(t *testing.T, err error)
	}{
		{
			name: "should create factory with valid extras",
			setupExtras: func(t *testing.T) []connection.Extra {
				extra1 := connection.NewMockExtra(t)
				extra1.EXPECT().Type().Return(provisioning.GithubConnectionType)

				extra2 := connection.NewMockExtra(t)
				extra2.EXPECT().Type().Return(provisioning.GitlabConnectionType)

				return []connection.Extra{extra1, extra2}
			},
			enabled: map[provisioning.ConnectionType]struct{}{
				provisioning.GithubConnectionType: {},
				provisioning.GitlabConnectionType: {},
			},
			wantErr: false,
		},
		{
			name: "should return error when duplicate connection types",
			setupExtras: func(t *testing.T) []connection.Extra {
				extra1 := connection.NewMockExtra(t)
				extra1.EXPECT().Type().Return(provisioning.GithubConnectionType)

				extra2 := connection.NewMockExtra(t)
				extra2.EXPECT().Type().Return(provisioning.GithubConnectionType)

				return []connection.Extra{extra1, extra2}
			},
			enabled: map[provisioning.ConnectionType]struct{}{
				provisioning.GithubConnectionType: {},
			},
			wantErr: true,
			validateError: func(t *testing.T, err error) {
				assert.Contains(t, err.Error(), "connection type \"github\" is already registered")
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			extras := tt.setupExtras(t)

			factory, err := connection.ProvideFactory(tt.enabled, extras)

			if tt.wantErr {
				require.Error(t, err)
				assert.Nil(t, factory)
				if tt.validateError != nil {
					tt.validateError(t, err)
				}
			} else {
				require.NoError(t, err)
				require.NotNil(t, factory)
			}
		})
	}
}

func TestFactory_Types(t *testing.T) {
	tests := []struct {
		name         string
		extraTypes   []provisioning.ConnectionType
		enabled      map[provisioning.ConnectionType]struct{}
		expectedLen  int
		expectedList []provisioning.ConnectionType
		checkSorted  bool
	}{
		{
			name:       "should return only enabled types that have extras",
			extraTypes: []provisioning.ConnectionType{provisioning.GithubConnectionType, provisioning.GitlabConnectionType},
			enabled: map[provisioning.ConnectionType]struct{}{
				provisioning.GithubConnectionType: {},
				provisioning.GitlabConnectionType: {},
			},
			expectedLen:  2,
			expectedList: []provisioning.ConnectionType{provisioning.GithubConnectionType, provisioning.GitlabConnectionType},
		},
		{
			name:       "should return sorted list of types",
			extraTypes: []provisioning.ConnectionType{provisioning.GitlabConnectionType, provisioning.GithubConnectionType},
			enabled: map[provisioning.ConnectionType]struct{}{
				provisioning.GithubConnectionType: {},
				provisioning.GitlabConnectionType: {},
			},
			expectedLen:  2,
			expectedList: []provisioning.ConnectionType{provisioning.GithubConnectionType, provisioning.GitlabConnectionType},
			checkSorted:  true,
		},
		{
			name:         "should return empty list when no types are enabled",
			extraTypes:   []provisioning.ConnectionType{provisioning.GithubConnectionType},
			enabled:      map[provisioning.ConnectionType]struct{}{},
			expectedLen:  0,
			expectedList: []provisioning.ConnectionType{},
		},
		{
			name:       "should not return types that are enabled but have no extras",
			extraTypes: []provisioning.ConnectionType{provisioning.GithubConnectionType},
			enabled: map[provisioning.ConnectionType]struct{}{
				provisioning.GithubConnectionType: {},
				provisioning.GitlabConnectionType: {},
			},
			expectedLen:  1,
			expectedList: []provisioning.ConnectionType{provisioning.GithubConnectionType},
		},
		{
			name:       "should not return types that have extras but are not enabled",
			extraTypes: []provisioning.ConnectionType{provisioning.GithubConnectionType, provisioning.GitlabConnectionType},
			enabled: map[provisioning.ConnectionType]struct{}{
				provisioning.GithubConnectionType: {},
			},
			expectedLen:  1,
			expectedList: []provisioning.ConnectionType{provisioning.GithubConnectionType},
		},
		{
			name:       "should return empty list when no extras are provided",
			extraTypes: []provisioning.ConnectionType{},
			enabled: map[provisioning.ConnectionType]struct{}{
				provisioning.GithubConnectionType: {},
			},
			expectedLen:  0,
			expectedList: []provisioning.ConnectionType{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup extras based on the types specified
			extras := make([]connection.Extra, 0, len(tt.extraTypes))
			for _, connType := range tt.extraTypes {
				extra := connection.NewMockExtra(t)
				extra.EXPECT().Type().Return(connType)
				extras = append(extras, extra)
			}

			factory, err := connection.ProvideFactory(tt.enabled, extras)
			require.NoError(t, err)

			types := factory.Types()

			assert.Len(t, types, tt.expectedLen)

			if tt.checkSorted {
				// Verify exact order: github should come before gitlab alphabetically
				assert.Equal(t, tt.expectedList, types)
			} else {
				// Just verify the types are present
				for _, expectedType := range tt.expectedList {
					assert.Contains(t, types, expectedType)
				}
			}
		})
	}
}

func TestFactory_Build(t *testing.T) {
	tests := []struct {
		name           string
		connectionType provisioning.ConnectionType
		setupExtras    func(t *testing.T, ctx context.Context) ([]connection.Extra, connection.Connection, error)
		enabled        map[provisioning.ConnectionType]struct{}
		wantErr        bool
		validateError  func(t *testing.T, err error)
	}{
		{
			name:           "should successfully build connection when type is enabled and has extra",
			connectionType: provisioning.GithubConnectionType,
			setupExtras: func(t *testing.T, ctx context.Context) ([]connection.Extra, connection.Connection, error) {
				mockConnection := connection.NewMockConnection(t)
				extra := connection.NewMockExtra(t)
				extra.EXPECT().Type().Return(provisioning.GithubConnectionType)
				extra.EXPECT().Build(ctx, &provisioning.Connection{
					ObjectMeta: metav1.ObjectMeta{Name: "test-connection"},
					Spec: provisioning.ConnectionSpec{
						Type: provisioning.GithubConnectionType,
					},
				}).Return(mockConnection, nil)

				return []connection.Extra{extra}, mockConnection, nil
			},
			enabled: map[provisioning.ConnectionType]struct{}{
				provisioning.GithubConnectionType: {},
			},
			wantErr: false,
		},
		{
			name:           "should return error when type is not enabled",
			connectionType: provisioning.GitlabConnectionType,
			setupExtras: func(t *testing.T, ctx context.Context) ([]connection.Extra, connection.Connection, error) {
				extra := connection.NewMockExtra(t)
				extra.EXPECT().Type().Return(provisioning.GitlabConnectionType)

				return []connection.Extra{extra}, nil, nil
			},
			enabled: map[provisioning.ConnectionType]struct{}{
				provisioning.GithubConnectionType: {},
			},
			wantErr: true,
			validateError: func(t *testing.T, err error) {
				assert.Contains(t, err.Error(), "connection type \"gitlab\" is not enabled")
			},
		},
		{
			name:           "should return error when type is not supported",
			connectionType: provisioning.GitlabConnectionType,
			setupExtras: func(t *testing.T, ctx context.Context) ([]connection.Extra, connection.Connection, error) {
				extra := connection.NewMockExtra(t)
				extra.EXPECT().Type().Return(provisioning.GithubConnectionType)

				return []connection.Extra{extra}, nil, nil
			},
			enabled: map[provisioning.ConnectionType]struct{}{
				provisioning.GithubConnectionType: {},
			},
			wantErr: true,
			validateError: func(t *testing.T, err error) {
				assert.Contains(t, err.Error(), "connection type \"gitlab\" is not supported")
			},
		},
		{
			name:           "should pass through errors from extra.Build()",
			connectionType: provisioning.GithubConnectionType,
			setupExtras: func(t *testing.T, ctx context.Context) ([]connection.Extra, connection.Connection, error) {
				buildErr := errors.New("build error")
				extra := connection.NewMockExtra(t)
				extra.EXPECT().Type().Return(provisioning.GithubConnectionType)
				extra.EXPECT().Build(ctx, &provisioning.Connection{
					ObjectMeta: metav1.ObjectMeta{Name: "test-connection"},
					Spec: provisioning.ConnectionSpec{
						Type: provisioning.GithubConnectionType,
					},
				}).Return(nil, buildErr)

				return []connection.Extra{extra}, nil, buildErr
			},
			enabled: map[provisioning.ConnectionType]struct{}{
				provisioning.GithubConnectionType: {},
			},
			wantErr: true,
			validateError: func(t *testing.T, err error) {
				assert.Equal(t, "build error", err.Error())
			},
		},
		{
			name:           "should build with multiple extras registered",
			connectionType: provisioning.GitlabConnectionType,
			setupExtras: func(t *testing.T, ctx context.Context) ([]connection.Extra, connection.Connection, error) {
				mockConnection := connection.NewMockConnection(t)

				extra1 := connection.NewMockExtra(t)
				extra1.EXPECT().Type().Return(provisioning.GithubConnectionType)

				extra2 := connection.NewMockExtra(t)
				extra2.EXPECT().Type().Return(provisioning.GitlabConnectionType)
				extra2.EXPECT().Build(ctx, &provisioning.Connection{
					ObjectMeta: metav1.ObjectMeta{Name: "test-connection"},
					Spec: provisioning.ConnectionSpec{
						Type: provisioning.GitlabConnectionType,
					},
				}).Return(mockConnection, nil)

				return []connection.Extra{extra1, extra2}, mockConnection, nil
			},
			enabled: map[provisioning.ConnectionType]struct{}{
				provisioning.GithubConnectionType: {},
				provisioning.GitlabConnectionType: {},
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()

			extras, expectedConnection, _ := tt.setupExtras(t, ctx)

			factory, err := connection.ProvideFactory(tt.enabled, extras)
			require.NoError(t, err)

			conn := &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test-connection"},
				Spec: provisioning.ConnectionSpec{
					Type: tt.connectionType,
				},
			}

			result, err := factory.Build(ctx, conn)

			if tt.wantErr {
				require.Error(t, err)
				assert.Nil(t, result)
				if tt.validateError != nil {
					tt.validateError(t, err)
				}
			} else {
				require.NoError(t, err)
				assert.Equal(t, expectedConnection, result)
			}
		})
	}
}

func TestFactory_Mutate(t *testing.T) {
	tests := []struct {
		name          string
		setupExtras   func(t *testing.T, ctx context.Context, obj runtime.Object) []connection.Extra
		enabled       map[provisioning.ConnectionType]struct{}
		obj           runtime.Object
		wantErr       bool
	}{
		{
			name: "should successfully mutate with single extra",
			setupExtras: func(t *testing.T, ctx context.Context, obj runtime.Object) []connection.Extra {
				extra := connection.NewMockExtra(t)
				extra.EXPECT().Type().Return(provisioning.GithubConnectionType)
				extra.EXPECT().Mutate(ctx, obj).Return(nil)

				return []connection.Extra{extra}
			},
			enabled: map[provisioning.ConnectionType]struct{}{
				provisioning.GithubConnectionType: {},
			},
			obj: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test-connection"},
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.GithubConnectionType,
				},
			},
			wantErr: false,
		},
		{
			name: "should return error if extra returns error",
			setupExtras: func(t *testing.T, ctx context.Context, obj runtime.Object) []connection.Extra {
				extra := connection.NewMockExtra(t)
				extra.EXPECT().Type().Return(provisioning.GithubConnectionType)
				extra.EXPECT().Mutate(ctx, obj).Return(assert.AnError)

				return []connection.Extra{extra}
			},
			enabled: map[provisioning.ConnectionType]struct{}{
				provisioning.GithubConnectionType: {},
			},
			obj: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test-connection"},
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.GithubConnectionType,
				},
			},
			wantErr: true,
		},
		{
			name: "should successfully mutate with multiple extras (all get called)",
			setupExtras: func(t *testing.T, ctx context.Context, obj runtime.Object) []connection.Extra {
				extra1 := connection.NewMockExtra(t)
				extra1.EXPECT().Type().Return(provisioning.GithubConnectionType)
				extra1.EXPECT().Mutate(ctx, obj).Return(nil)

				extra2 := connection.NewMockExtra(t)
				extra2.EXPECT().Type().Return(provisioning.GitlabConnectionType)
				extra2.EXPECT().Mutate(ctx, obj).Return(nil)

				return []connection.Extra{extra1, extra2}
			},
			enabled: map[provisioning.ConnectionType]struct{}{
				provisioning.GithubConnectionType: {},
				provisioning.GitlabConnectionType: {},
			},
			obj: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test-connection"},
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.GithubConnectionType,
				},
			},
			wantErr: false,
		},
		{
			name: "should succeed with no extras registered",
			setupExtras: func(t *testing.T, ctx context.Context, obj runtime.Object) []connection.Extra {
				return []connection.Extra{}
			},
			enabled: map[provisioning.ConnectionType]struct{}{
				provisioning.GithubConnectionType: {},
			},
			obj: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test-connection"},
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.GithubConnectionType,
				},
			},
			wantErr: false,
		},
		{
			name: "should handle wrong object type (non-Connection)",
			setupExtras: func(t *testing.T, ctx context.Context, obj runtime.Object) []connection.Extra {
				extra := connection.NewMockExtra(t)
				extra.EXPECT().Type().Return(provisioning.GithubConnectionType)
				// Mutate should be called but handle non-Connection object gracefully
				extra.EXPECT().Mutate(ctx, obj).Return(nil)

				return []connection.Extra{extra}
			},
			enabled: map[provisioning.ConnectionType]struct{}{
				provisioning.GithubConnectionType: {},
			},
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "test-repo"},
			}, // This will be replaced with a Repository object in the test
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			var extras []connection.Extra
			if tt.setupExtras != nil {
				extras = append(extras, tt.setupExtras(t, ctx, tt.obj)...)
			}

			factory, err := connection.ProvideFactory(tt.enabled, extras)
			require.NoError(t, err)

			err = factory.Mutate(ctx, tt.obj)

			if tt.wantErr {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}
		})
	}
}
