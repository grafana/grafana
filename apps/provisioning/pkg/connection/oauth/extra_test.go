package oauth_test

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/validation/field"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection/oauth"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

func TestExtra_Type(t *testing.T) {
	e := newTestExtra(t, connection.NewMockSecureValues(t), nil)
	assert.Equal(t, provisioning.GitlabConnectionType, e.Type())
}

func TestExtra_Build(t *testing.T) {
	tests := []struct {
		name        string
		conn        *provisioning.Connection
		setup       func(m *connection.MockSecureValues)
		expectedErr string
	}{
		{
			name: "success",
			conn: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test-connection"},
				Spec: provisioning.ConnectionSpec{
					Type:  provisioning.GitlabConnectionType,
					OAuth: &provisioning.ConnectionOAuthConfig{ClientID: "client-id"},
				},
			},
			setup: func(m *connection.MockSecureValues) {
				m.EXPECT().ClientSecret(mock.Anything).Return("client-secret", nil)
				m.EXPECT().Token(mock.Anything).Return("token", nil)
			},
		},
		{
			name:        "failure - nil connection",
			expectedErr: "oauth configuration is required",
		},
		{
			name: "failure - missing oauth config",
			conn: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test-connection"},
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.GitlabConnectionType,
				},
			},
			expectedErr: "oauth configuration is required",
		},
		{
			name: "failure - client secret decrypt error",
			conn: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test-connection"},
				Spec: provisioning.ConnectionSpec{
					Type:  provisioning.GitlabConnectionType,
					OAuth: &provisioning.ConnectionOAuthConfig{ClientID: "client-id"},
				},
			},
			setup: func(m *connection.MockSecureValues) {
				m.EXPECT().ClientSecret(mock.Anything).Return("", errors.New("boom"))
			},
			expectedErr: "decrypt client secret: boom",
		},
		{
			name: "failure - token decrypt error",
			conn: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test-connection"},
				Spec: provisioning.ConnectionSpec{
					Type:  provisioning.GitlabConnectionType,
					OAuth: &provisioning.ConnectionOAuthConfig{ClientID: "client-id"},
				},
			},
			setup: func(m *connection.MockSecureValues) {
				m.EXPECT().ClientSecret(mock.Anything).Return("client-secret", nil)
				m.EXPECT().Token(mock.Anything).Return("", errors.New("boom"))
			},
			expectedErr: "decrypt token: boom",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			secure := connection.NewMockSecureValues(t)
			if tt.setup != nil {
				tt.setup(secure)
			}

			e := newTestExtra(t, secure, nil)

			result, err := e.Build(t.Context(), tt.conn)
			if tt.expectedErr != "" {
				require.EqualError(t, err, tt.expectedErr)
				return
			}
			require.NoError(t, err)
			require.NotNil(t, result)
		})
	}
}

func TestExtra_Mutate(t *testing.T) {
	e := newTestExtra(t, connection.NewMockSecureValues(t), nil)
	require.NoError(t, e.Mutate(t.Context(), &provisioning.Connection{}))
}

func TestExtra_Validate(t *testing.T) {
	tests := []struct {
		name          string
		obj           runtime.Object
		validateSpec  oauth.ValidateSpecFunc
		errorContains []string
	}{
		{
			name: "non-connection object",
			obj:  &runtime.Unknown{},
		},
		{
			name: "connection of another type",
			obj: &provisioning.Connection{
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.GithubConnectionType,
				},
			},
		},
		{
			name: "missing oauth config",
			obj: &provisioning.Connection{
				Spec: provisioning.ConnectionSpec{
					Type: provisioning.GitlabConnectionType,
				},
			},
			errorContains: []string{"oauth info must be specified", "clientSecret"},
		},
		{
			name: "missing client ID",
			obj: &provisioning.Connection{
				Spec: provisioning.ConnectionSpec{
					Type:  provisioning.GitlabConnectionType,
					OAuth: &provisioning.ConnectionOAuthConfig{},
				},
				Secure: provisioning.ConnectionSecure{
					ClientSecret: common.InlineSecureValue{Create: common.NewSecretValue("client-secret")},
				},
			},
			errorContains: []string{"clientID must be specified"},
		},
		{
			name: "missing client secret",
			obj: &provisioning.Connection{
				Spec: provisioning.ConnectionSpec{
					Type:  provisioning.GitlabConnectionType,
					OAuth: &provisioning.ConnectionOAuthConfig{ClientID: "client-id"},
				},
			},
			errorContains: []string{"clientSecret must be specified"},
		},
		{
			name: "removed client secret",
			obj: &provisioning.Connection{
				Spec: provisioning.ConnectionSpec{
					Type:  provisioning.GitlabConnectionType,
					OAuth: &provisioning.ConnectionOAuthConfig{ClientID: "client-id"},
				},
				Secure: provisioning.ConnectionSecure{
					ClientSecret: common.InlineSecureValue{Remove: true},
				},
			},
			errorContains: []string{"clientSecret must be specified"},
		},
		{
			name: "forbidden private key",
			obj: &provisioning.Connection{
				Spec: provisioning.ConnectionSpec{
					Type:  provisioning.GitlabConnectionType,
					OAuth: &provisioning.ConnectionOAuthConfig{ClientID: "client-id"},
				},
				Secure: provisioning.ConnectionSecure{
					ClientSecret: common.InlineSecureValue{Create: common.NewSecretValue("client-secret")},
					PrivateKey:   common.InlineSecureValue{Create: common.NewSecretValue("private-key")},
				},
			},
			errorContains: []string{"privateKey is forbidden"},
		},
		{
			name: "provider-specific spec errors are appended",
			obj: &provisioning.Connection{
				Spec: provisioning.ConnectionSpec{
					Type:  provisioning.GitlabConnectionType,
					OAuth: &provisioning.ConnectionOAuthConfig{ClientID: "client-id"},
				},
				Secure: provisioning.ConnectionSecure{
					ClientSecret: common.InlineSecureValue{Create: common.NewSecretValue("client-secret")},
				},
			},
			validateSpec: func(_ provisioning.ConnectionSpec) field.ErrorList {
				return field.ErrorList{field.Required(field.NewPath("spec", "custom"), "custom must be specified")}
			},
			errorContains: []string{"custom must be specified"},
		},
		{
			name: "valid",
			obj: &provisioning.Connection{
				Spec: provisioning.ConnectionSpec{
					Type:  provisioning.GitlabConnectionType,
					OAuth: &provisioning.ConnectionOAuthConfig{ClientID: "client-id"},
				},
				Secure: provisioning.ConnectionSecure{
					ClientSecret: common.InlineSecureValue{Create: common.NewSecretValue("client-secret")},
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			e := newTestExtra(t, connection.NewMockSecureValues(t), tt.validateSpec)

			list := e.Validate(t.Context(), tt.obj)
			if len(tt.errorContains) == 0 {
				assert.Empty(t, list)
				return
			}
			require.NotEmpty(t, list)
			errStr := list.ToAggregate().Error()
			for _, contains := range tt.errorContains {
				assert.Contains(t, errStr, contains)
			}
		})
	}
}

func newTestExtra(t *testing.T, secure *connection.MockSecureValues, validateSpec oauth.ValidateSpecFunc) connection.Extra {
	return oauth.NewExtra(
		func(*provisioning.Connection) connection.SecureValues { return secure },
		provisioning.GitlabConnectionType,
		provisioning.GitLabRepositoryType,
		func(_ provisioning.ConnectionSpec) oauth.Provider { return oauth.NewMockProvider(t) },
		validateSpec,
	)
}
