package appinstaller

import (
	"context"
	"testing"

	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"
)

func TestRegisterAuthorizers(t *testing.T) {
	tests := []struct {
		name              string
		appInstallers     []appsdkapiserver.AppInstaller
		expectedRegisters int
	}{
		{
			name:              "empty installers list",
			appInstallers:     []appsdkapiserver.AppInstaller{},
			expectedRegisters: 0,
		},
		{
			name: "installer without authorizer provider",
			appInstallers: []appsdkapiserver.AppInstaller{
				&mockAppInstaller{
					groupVersions: []schema.GroupVersion{
						{Group: "test.example.com", Version: "v1"},
					},
				},
			},
			expectedRegisters: 0,
		},
		{
			name: "single installer with authorizer provider",
			appInstallers: []appsdkapiserver.AppInstaller{
				&mockAppInstallerWithAuth{
					mockAppInstaller: &mockAppInstaller{
						groupVersions: []schema.GroupVersion{
							{Group: "test.example.com", Version: "v1"},
						},
					},
					mockAuthorizer: &mockAuthorizer{},
				},
			},
			expectedRegisters: 1,
		},
		{
			name: "installer with multiple group versions",
			appInstallers: []appsdkapiserver.AppInstaller{
				&mockAppInstallerWithAuth{
					mockAppInstaller: &mockAppInstaller{
						groupVersions: []schema.GroupVersion{
							{Group: "test.example.com", Version: "v1"},
							{Group: "test.example.com", Version: "v2"},
							{Group: "other.example.com", Version: "v1"},
						},
					},
					mockAuthorizer: &mockAuthorizer{},
				},
			},
			expectedRegisters: 3,
		},
		{
			name: "multiple installers with mixed authorizer support",
			appInstallers: []appsdkapiserver.AppInstaller{
				&mockAppInstallerWithAuth{
					mockAppInstaller: &mockAppInstaller{
						groupVersions: []schema.GroupVersion{
							{Group: "test.example.com", Version: "v1"},
						},
					},
					mockAuthorizer: &mockAuthorizer{},
				},
				&mockAppInstaller{
					groupVersions: []schema.GroupVersion{
						{Group: "other.example.com", Version: "v1"},
					},
				},
				&mockAppInstallerWithAuth{
					mockAppInstaller: &mockAppInstaller{
						groupVersions: []schema.GroupVersion{
							{Group: "another.example.com", Version: "v1"},
							{Group: "another.example.com", Version: "v2"},
						},
					},
					mockAuthorizer: &mockAuthorizer{},
				},
			},
			expectedRegisters: 3, // 1 from first installer + 2 from third installer
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			registrar := &mockAuthorizerRegistrar{}
			RegisterAuthorizers(ctx, tt.appInstallers, registrar)
			require.Equal(t, tt.expectedRegisters, len(registrar.registrations))
		})
	}
}

type mockAppInstaller struct {
	appsdkapiserver.AppInstaller // Embed the interface
	groupVersions                []schema.GroupVersion
}

func (m *mockAppInstaller) GroupVersions() []schema.GroupVersion {
	return m.groupVersions
}

type mockAppInstallerWithAuth struct {
	*mockAppInstaller
	mockAuthorizer authorizer.Authorizer
}

func (m *mockAppInstallerWithAuth) GetAuthorizer() authorizer.Authorizer {
	return m.mockAuthorizer
}

type mockRegistration struct {
	groupVersion schema.GroupVersion
	authorizer   authorizer.Authorizer
}

type mockAuthorizerRegistrar struct {
	registrations []mockRegistration
}

func (m *mockAuthorizerRegistrar) Register(gv schema.GroupVersion, auth authorizer.Authorizer) {
	m.registrations = append(m.registrations, mockRegistration{
		groupVersion: gv,
		authorizer:   auth,
	})
}

type mockAuthorizer struct{}

func (m *mockAuthorizer) Authorize(ctx context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
	return authorizer.DecisionAllow, "test", nil
}
