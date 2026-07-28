package annotationsapi

import (
	"context"
	"net/http"
	"testing"

	authnlib "github.com/grafana/authlib/authn"
	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type fakeTokenExchanger struct {
	gotRequest authnlib.TokenExchangeRequest
}

func (f *fakeTokenExchanger) Exchange(_ context.Context, r authnlib.TokenExchangeRequest) (*authnlib.TokenExchangeResponse, error) {
	f.gotRequest = r
	return &authnlib.TokenExchangeResponse{Token: "signed-token"}, nil
}

type stubRoundTripper struct {
	gotToken string
}

func (s *stubRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	s.gotToken = req.Header.Get("X-Access-Token")
	return &http.Response{StatusCode: http.StatusOK, Body: http.NoBody}, nil
}

func TestNewAnnotationAPIClient_TokenExchange(t *testing.T) {
	tests := []struct {
		name          string
		stackID       string
		requester     *identity.StaticRequester
		wantNamespace string
		wantSubject   *authnlib.TokenExchangeSubject
		wantErr       bool
	}{
		{
			name:          "scopes to stack namespace and asserts the user on behalf of",
			stackID:       "123",
			requester:     &identity.StaticRequester{Type: claims.TypeUser, UserID: 42, UserUID: "user-uid", OrgID: 1},
			wantNamespace: "stacks-123",
			wantSubject:   &authnlib.TokenExchangeSubject{Sub: "user:42", Identifier: "user-uid", Type: "user", Namespace: "stacks-123"},
		},
		{
			name:          "scopes to the default namespace when stackID is not set and orgID is 1",
			requester:     &identity.StaticRequester{Type: claims.TypeUser, UserID: 42, UserUID: "user-uid", OrgID: 1},
			wantNamespace: "default",
			wantSubject:   &authnlib.TokenExchangeSubject{Sub: "user:42", Identifier: "user-uid", Type: "user", Namespace: "default"},
		},
		{
			name:          "scopes to the org namespace when stackID is not set and orgID is not 1",
			requester:     &identity.StaticRequester{Type: claims.TypeServiceAccount, UserID: 7, UserUID: "sa-uid", OrgID: 7},
			wantNamespace: "org-7",
			wantSubject:   &authnlib.TokenExchangeSubject{Sub: "service-account:7", Identifier: "sa-uid", Type: "service-account", Namespace: "org-7"},
		},
		{
			name:          "access policy has no on-behalf-of subject",
			requester:     &identity.StaticRequester{Type: claims.TypeAccessPolicy, UserID: 3, UserUID: "ap-uid", OrgID: 1},
			wantNamespace: "default",
			wantSubject:   nil,
		},
		{
			name:    "fails when the requester is missing",
			stackID: "123",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := &setting.Cfg{
				StackID: tt.stackID,
				AnnotationAppPlatform: setting.AnnotationAppPlatformSettings{
					APIServerURL: "https://annotation.cluster.local",
				},
			}

			exchanger := &fakeTokenExchanger{}
			c := newAnnotationAPIClient(cfg, nil, exchanger)
			require.NotNil(t, c)
			require.NotNil(t, c.restCfg.WrapTransport)

			next := &stubRoundTripper{}
			rt := c.restCfg.WrapTransport(next)

			req, err := http.NewRequest(http.MethodPost, cfg.AnnotationAppPlatform.APIServerURL+"/annotations", http.NoBody)
			require.NoError(t, err)
			if tt.requester != nil {
				req = req.WithContext(identity.WithRequester(req.Context(), tt.requester))
			}

			resp, err := rt.RoundTrip(req)
			if tt.wantErr {
				require.Error(t, err)
				assert.Empty(t, next.gotToken)
				return
			}
			require.NoError(t, err)
			defer func() { require.NoError(t, resp.Body.Close()) }()
			require.Equal(t, http.StatusOK, resp.StatusCode)

			assert.Equal(t, tt.wantNamespace, exchanger.gotRequest.Namespace)
			assert.Equal(t, []string{annotationServerAudience}, exchanger.gotRequest.Audiences)
			assert.Equal(t, tt.wantSubject, exchanger.gotRequest.Subject)
			assert.Equal(t, "signed-token", next.gotToken)
		})
	}
}
