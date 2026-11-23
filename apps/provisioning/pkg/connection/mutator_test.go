package connection

import (
	"cmp"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/apiserver/pkg/authentication/user"

	"github.com/grafana/grafana-app-sdk/resource"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

func newMutatorTestAttributes(obj, old runtime.Object, op admission.Operation) admission.Attributes {
	return newMutatorTestAttributesWithSubresource(obj, old, op, "")
}

func newMutatorTestAttributesWithSubresource(obj, old runtime.Object, op admission.Operation, subresource string) admission.Attributes {
	return admission.NewAttributesRecord(
		obj,
		old,
		provisioning.ConnectionResourceInfo.GroupVersionKind(),
		"default",
		"test",
		provisioning.ConnectionResourceInfo.GroupVersionResource(),
		subresource,
		op,
		nil,
		false,
		&user.DefaultInfo{},
	)
}

func TestAdmissionMutator_Mutate(t *testing.T) {
	tests := []struct {
		name                     string
		obj                      runtime.Object
		factoryErr               error
		expectObjectNameContains string
		wantErr                  bool
		wantErrContains          string
	}{
		{
			name: "doesn't generate name calls factory mutate for connection",
			obj: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "existing-name"},
				Spec:       provisioning.ConnectionSpec{Type: provisioning.ConnectionTypeGithub},
			},
			expectObjectNameContains: "existing-name",
			wantErr:                  false,
		},
		{
			name: "generates name with given prefix and calls factory mutate for connection",
			obj: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{GenerateName: "test-"},
				Spec:       provisioning.ConnectionSpec{Type: provisioning.ConnectionTypeGithub},
			},
			expectObjectNameContains: "test-",
			wantErr:                  false,
		},
		{
			name: "generates name with type prefix and calls factory mutate for connection",
			obj: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{},
				Spec:       provisioning.ConnectionSpec{Type: provisioning.ConnectionTypeGithub},
			},
			expectObjectNameContains: "github-",
			wantErr:                  false,
		},
		{
			name:    "returns nil for nil object",
			obj:     nil,
			wantErr: false,
		},
		{
			name:            "returns error for non-connection object",
			obj:             &provisioning.Repository{},
			wantErr:         true,
			wantErrContains: "expected connection configuration",
		},
		{
			name: "propagates factory mutate error",
			obj: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test"},
				Spec:       provisioning.ConnectionSpec{Type: provisioning.ConnectionTypeGithub},
			},
			factoryErr:      errors.New("factory error"),
			wantErr:         true,
			wantErrContains: "factory error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			factory := NewMockFactory(t)

			// Only set up mock if we expect it to be called
			if tt.obj != nil {
				if _, ok := tt.obj.(*provisioning.Connection); ok {
					factory.EXPECT().Mutate(mock.Anything, mock.Anything).Return(tt.factoryErr).Maybe()
				}
			}

			m := NewAdmissionMutator(factory)
			attr := newMutatorTestAttributes(tt.obj, nil, admission.Create)

			err := m.Mutate(t.Context(), attr, nil)

			if tt.wantErr {
				require.Error(t, err)
				if tt.wantErrContains != "" {
					assert.Contains(t, err.Error(), tt.wantErrContains)
				}
				return
			}

			require.NoError(t, err)
			if tt.obj != nil {
				require.Contains(t, tt.obj.(*provisioning.Connection).Name, tt.expectObjectNameContains)
			}
		})
	}
}

func TestAdmissionMutator_MutateUpdateOAuthToken(t *testing.T) {
	tests := []struct {
		name         string
		newType      provisioning.ConnectionType
		newURL       string
		newServerURL string
		oldServerURL string
		newGitOAuth  *provisioning.ConnectionGitOAuthConfig
		oldGitOAuth  *provisioning.ConnectionGitOAuthConfig
		newOAuth     *provisioning.ConnectionOAuthConfig
		newSecure    provisioning.ConnectionSecure
		oldOAuth     *provisioning.ConnectionOAuthConfig
		wantToken    resource.InlineSecureValue
	}{
		{
			name:      "removes token when connection type is changed",
			newType:   provisioning.ConnectionTypeGitlabOAuth,
			newOAuth:  &provisioning.ConnectionOAuthConfig{ClientID: "same-client"},
			oldOAuth:  &provisioning.ConnectionOAuthConfig{ClientID: "same-client"},
			wantToken: resource.InlineSecureValue{Remove: true},
		},
		{
			name:      "removes token when connection URL is changed",
			newURL:    "https://gitlab.example.com",
			newOAuth:  &provisioning.ConnectionOAuthConfig{ClientID: "same-client"},
			oldOAuth:  &provisioning.ConnectionOAuthConfig{ClientID: "same-client"},
			wantToken: resource.InlineSecureValue{Remove: true},
		},
		{
			name:         "removes token when github enterprise server URL is changed",
			newServerURL: "https://new-ghes.example.com",
			oldServerURL: "https://old-ghes.example.com",
			newOAuth:     &provisioning.ConnectionOAuthConfig{ClientID: "same-client"},
			oldOAuth:     &provisioning.ConnectionOAuthConfig{ClientID: "same-client"},
			wantToken:    resource.InlineSecureValue{Remove: true},
		},
		{
			name:         "keeps token when github enterprise server URL is unchanged",
			newServerURL: "https://ghes.example.com",
			oldServerURL: "https://ghes.example.com",
			newOAuth:     &provisioning.ConnectionOAuthConfig{ClientID: "same-client"},
			oldOAuth:     &provisioning.ConnectionOAuthConfig{ClientID: "same-client"},
			wantToken:    resource.InlineSecureValue{},
		},
		{
			name:        "removes token when git oauth token URL is changed",
			newGitOAuth: &provisioning.ConnectionGitOAuthConfig{TokenURL: "https://new.example.com/oauth/token"},
			oldGitOAuth: &provisioning.ConnectionGitOAuthConfig{TokenURL: "https://old.example.com/oauth/token"},
			newOAuth:    &provisioning.ConnectionOAuthConfig{ClientID: "same-client"},
			oldOAuth:    &provisioning.ConnectionOAuthConfig{ClientID: "same-client"},
			wantToken:   resource.InlineSecureValue{Remove: true},
		},
		{
			name:        "removes token when git oauth scopes are changed",
			newGitOAuth: &provisioning.ConnectionGitOAuthConfig{Scopes: []string{"read_repository", "write_repository"}},
			oldGitOAuth: &provisioning.ConnectionGitOAuthConfig{Scopes: []string{"read_repository"}},
			newOAuth:    &provisioning.ConnectionOAuthConfig{ClientID: "same-client"},
			oldOAuth:    &provisioning.ConnectionOAuthConfig{ClientID: "same-client"},
			wantToken:   resource.InlineSecureValue{Remove: true},
		},
		{
			name:        "keeps token when git oauth settings are unchanged",
			newGitOAuth: &provisioning.ConnectionGitOAuthConfig{TokenURL: "https://git.example.com/oauth/token", Scopes: []string{"read_repository"}},
			oldGitOAuth: &provisioning.ConnectionGitOAuthConfig{TokenURL: "https://git.example.com/oauth/token", Scopes: []string{"read_repository"}},
			newOAuth:    &provisioning.ConnectionOAuthConfig{ClientID: "same-client"},
			oldOAuth:    &provisioning.ConnectionOAuthConfig{ClientID: "same-client"},
			wantToken:   resource.InlineSecureValue{},
		},
		{
			name:      "keeps token when oauth credentials are unchanged",
			newOAuth:  &provisioning.ConnectionOAuthConfig{ClientID: "same-client"},
			oldOAuth:  &provisioning.ConnectionOAuthConfig{ClientID: "same-client"},
			wantToken: resource.InlineSecureValue{},
		},
		{
			name:      "removes token when oauth client ID is changed",
			newOAuth:  &provisioning.ConnectionOAuthConfig{ClientID: "new-client"},
			oldOAuth:  &provisioning.ConnectionOAuthConfig{ClientID: "old-client"},
			wantToken: resource.InlineSecureValue{Remove: true},
		},
		{
			name:     "removes token when oauth client secret is changed",
			newOAuth: &provisioning.ConnectionOAuthConfig{ClientID: "same-client"},
			newSecure: provisioning.ConnectionSecure{
				ClientSecret: resource.InlineSecureValue{Create: "new-secret-value"},
			},
			oldOAuth:  &provisioning.ConnectionOAuthConfig{ClientID: "same-client"},
			wantToken: resource.InlineSecureValue{Remove: true},
		},
		{
			name:     "removes token when oauth client secret reference is changed",
			newOAuth: &provisioning.ConnectionOAuthConfig{ClientID: "same-client"},
			newSecure: provisioning.ConnectionSecure{
				ClientSecret: resource.InlineSecureValue{Name: "new-secret"},
			},
			oldOAuth:  &provisioning.ConnectionOAuthConfig{ClientID: "same-client"},
			wantToken: resource.InlineSecureValue{Remove: true},
		},
		{
			name:     "keeps token when oauth client secret reference is unchanged",
			newOAuth: &provisioning.ConnectionOAuthConfig{ClientID: "same-client"},
			newSecure: provisioning.ConnectionSecure{
				ClientSecret: resource.InlineSecureValue{Name: "old-secret"},
			},
			oldOAuth:  &provisioning.ConnectionOAuthConfig{ClientID: "same-client"},
			wantToken: resource.InlineSecureValue{},
		},
		{
			name:      "keeps token when connection is not oauth",
			wantToken: resource.InlineSecureValue{},
		},
		{
			name:      "removes token when connection switches away from oauth",
			oldOAuth:  &provisioning.ConnectionOAuthConfig{ClientID: "old-client"},
			wantToken: resource.InlineSecureValue{Remove: true},
		},
		{
			name:      "removes token when connection switches to oauth",
			newOAuth:  &provisioning.ConnectionOAuthConfig{ClientID: "new-client"},
			wantToken: resource.InlineSecureValue{Remove: true},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			factory := NewMockFactory(t)
			factory.EXPECT().Mutate(mock.Anything, mock.Anything).Return(nil)

			obj := &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test"},
				Spec: provisioning.ConnectionSpec{
					Type:                  cmp.Or(tt.newType, provisioning.ConnectionTypeGithub),
					Url:                   tt.newURL,
					Oauth:                 tt.newOAuth,
					GithubEnterpriseOAuth: githubEnterpriseConfig(tt.newServerURL),
					GitOAuth:              tt.newGitOAuth,
				},
				Secure: tt.newSecure,
			}
			old := &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test"},
				Spec: provisioning.ConnectionSpec{
					Type:                  provisioning.ConnectionTypeGithub,
					Oauth:                 tt.oldOAuth,
					GithubEnterpriseOAuth: githubEnterpriseConfig(tt.oldServerURL),
					GitOAuth:              tt.oldGitOAuth,
				},
				Secure: provisioning.ConnectionSecure{
					Token:        resource.InlineSecureValue{Name: "old-token"},
					ClientSecret: resource.InlineSecureValue{Name: "old-secret"},
				},
			}

			m := NewAdmissionMutator(factory)
			require.NoError(t, m.Mutate(t.Context(), newMutatorTestAttributes(obj, old, admission.Update), nil))
			assert.Equal(t, tt.wantToken, obj.Secure.Token)
		})
	}
}

func TestAdmissionMutator_Mutate_SkipsSubresourcePatches(t *testing.T) {
	factory := NewMockFactory(t)
	// No EXPECT() set up for Mutate: the mock will fail the test if it's called,
	// confirming extras never run for status patches.

	conn := &provisioning.Connection{
		ObjectMeta: metav1.ObjectMeta{Name: "test"},
		Spec:       provisioning.ConnectionSpec{Type: provisioning.ConnectionTypeGithub},
	}
	old := conn.DeepCopy()

	m := NewAdmissionMutator(factory)
	attr := newMutatorTestAttributesWithSubresource(conn, old, admission.Update, "status")

	require.NoError(t, m.Mutate(t.Context(), attr, nil))
}

func TestAdmissionMutator_Mutate_RunsForBundledSpecChange(t *testing.T) {
	old := &provisioning.Connection{
		ObjectMeta: metav1.ObjectMeta{Name: "test"},
		Spec:       provisioning.ConnectionSpec{Type: provisioning.ConnectionTypeGithub, Url: "https://old.example.com"},
		Secure:     provisioning.ConnectionSecure{Token: resource.InlineSecureValue{Name: "old-token"}},
	}
	// Bundled onto a /status request: URL change without a new token must
	// still trigger the OAuth token removal in Mutate.
	conn := old.DeepCopy()
	conn.Spec.Oauth = &provisioning.ConnectionOAuthConfig{ClientID: "client"}
	old.Spec.Oauth = &provisioning.ConnectionOAuthConfig{ClientID: "client"}
	conn.Spec.Url = "https://new.example.com"

	factory := NewMockFactory(t)
	factory.EXPECT().Mutate(mock.Anything, mock.Anything).Return(nil).Once()

	m := NewAdmissionMutator(factory)
	attr := newMutatorTestAttributesWithSubresource(conn, old, admission.Update, "status")

	require.NoError(t, m.Mutate(t.Context(), attr, nil))
	assert.True(t, conn.Secure.Token.Remove, "URL change should invalidate the stored OAuth token even on a bundled status request")
}

func githubEnterpriseConfig(serverURL string) *provisioning.ConnectionGitHubEnterpriseOAuthConfig {
	if serverURL == "" {
		return nil
	}
	return &provisioning.ConnectionGitHubEnterpriseOAuthConfig{ServerUrl: serverURL}
}

func TestCopySecureValues(t *testing.T) {
	tests := []struct {
		name             string
		new              *provisioning.Connection
		old              *provisioning.Connection
		wantPrivateKey   resource.InlineSecureValue
		wantToken        resource.InlineSecureValue
		wantClientSecret resource.InlineSecureValue
	}{
		{
			name: "copies private key from old to new when new is zero",
			new:  &provisioning.Connection{},
			old: &provisioning.Connection{
				Secure: provisioning.ConnectionSecure{
					PrivateKey: resource.InlineSecureValue{Name: "old-key"},
				},
			},
			wantPrivateKey: resource.InlineSecureValue{Name: "old-key"},
		},
		{
			name: "copies token from old to new when new is zero",
			new:  &provisioning.Connection{},
			old: &provisioning.Connection{
				Secure: provisioning.ConnectionSecure{
					Token: resource.InlineSecureValue{Name: "old-token"},
				},
			},
			wantToken: resource.InlineSecureValue{Name: "old-token"},
		},
		{
			name: "copies client secret from old to new when new is zero",
			new:  &provisioning.Connection{},
			old: &provisioning.Connection{
				Secure: provisioning.ConnectionSecure{
					ClientSecret: resource.InlineSecureValue{Name: "old-secret"},
				},
			},
			wantClientSecret: resource.InlineSecureValue{Name: "old-secret"},
		},
		{
			name: "does not overwrite existing values in new",
			new: &provisioning.Connection{
				Secure: provisioning.ConnectionSecure{
					PrivateKey:   resource.InlineSecureValue{Name: "new-key"},
					Token:        resource.InlineSecureValue{Name: "new-token"},
					ClientSecret: resource.InlineSecureValue{Name: "new-secret"},
				},
			},
			old: &provisioning.Connection{
				Secure: provisioning.ConnectionSecure{
					PrivateKey:   resource.InlineSecureValue{Name: "old-key"},
					Token:        resource.InlineSecureValue{Name: "old-token"},
					ClientSecret: resource.InlineSecureValue{Name: "old-secret"},
				},
			},
			wantPrivateKey:   resource.InlineSecureValue{Name: "new-key"},
			wantToken:        resource.InlineSecureValue{Name: "new-token"},
			wantClientSecret: resource.InlineSecureValue{Name: "new-secret"},
		},
		{
			name:           "handles nil old connection",
			new:            &provisioning.Connection{},
			old:            nil,
			wantPrivateKey: resource.InlineSecureValue{},
		},
		{
			name:           "handles old connection with zero secure values",
			new:            &provisioning.Connection{},
			old:            &provisioning.Connection{},
			wantPrivateKey: resource.InlineSecureValue{},
		},
		{
			name: "copies all values when all are zero in new",
			new:  &provisioning.Connection{},
			old: &provisioning.Connection{
				Secure: provisioning.ConnectionSecure{
					PrivateKey:   resource.InlineSecureValue{Name: "old-key"},
					Token:        resource.InlineSecureValue{Name: "old-token"},
					ClientSecret: resource.InlineSecureValue{Name: "old-secret"},
				},
			},
			wantPrivateKey:   resource.InlineSecureValue{Name: "old-key"},
			wantToken:        resource.InlineSecureValue{Name: "old-token"},
			wantClientSecret: resource.InlineSecureValue{Name: "old-secret"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			CopySecureValues(tt.new, tt.old)
			assert.Equal(t, tt.wantPrivateKey, tt.new.Secure.PrivateKey)
			assert.Equal(t, tt.wantToken, tt.new.Secure.Token)
			assert.Equal(t, tt.wantClientSecret, tt.new.Secure.ClientSecret)
		})
	}
}
