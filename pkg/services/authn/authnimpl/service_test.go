package authnimpl

import (
	"context"
	"errors"
	"net/http"
	"net/url"
	"slices"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/codes"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"

	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/models/usertoken"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/auth/authtest"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/authn/authntest"
	"github.com/grafana/grafana/pkg/setting"
)

func TestService_Authenticate(t *testing.T) {
	type TestCase struct {
		desc             string
		clients          []authn.Client
		expectedIdentity *authn.Identity
		expectedErrors   []error
	}

	var (
		firstErr = errors.New("first")
		lastErr  = errors.New("last")
	)

	tests := []TestCase{
		{
			desc: "should succeed with authentication for configured client",
			clients: []authn.Client{
				&authntest.FakeClient{ExpectedTest: true, ExpectedIdentity: &authn.Identity{ID: "1", Type: claims.TypeUser}},
			},
			expectedIdentity: &authn.Identity{ID: "1", Type: claims.TypeUser},
		},
		{
			desc: "should succeed with authentication for configured client for identity with fetch permissions params",
			clients: []authn.Client{
				&authntest.FakeClient{
					ExpectedTest: true,
					ExpectedIdentity: &authn.Identity{
						ID:   "2",
						Type: claims.TypeUser,
						ClientParams: authn.ClientParams{
							FetchPermissionsParams: authn.FetchPermissionsParams{
								RestrictedActions: []string{
									"datasources:read",
									"datasources:query",
								},
								Roles: []string{
									"fixed:datasources:reader",
								},
							},
						},
					},
				},
			},
			expectedIdentity: &authn.Identity{
				ID:   "2",
				Type: claims.TypeUser,
				ClientParams: authn.ClientParams{
					FetchPermissionsParams: authn.FetchPermissionsParams{
						RestrictedActions: []string{
							"datasources:read",
							"datasources:query",
						},
						Roles: []string{
							"fixed:datasources:reader",
						},
					},
				},
			},
		},
		{
			desc: "should succeed with authentication for client with fetch permissions params made of roles and actions",
			clients: []authn.Client{
				&authntest.FakeClient{
					ExpectedTest: true,
					ExpectedIdentity: &authn.Identity{
						ID:   "2",
						Type: claims.TypeUser,
						ClientParams: authn.ClientParams{
							FetchPermissionsParams: authn.FetchPermissionsParams{
								RestrictedActions: []string{
									"datasources:read",
									"datasources:query",
								},
								AllowedActions: []string{
									"datasources:write",
								},
								Roles: []string{
									"fixed:datasources:writer",
								},
							},
						},
					},
				},
			},
			expectedIdentity: &authn.Identity{
				ID:   "2",
				Type: claims.TypeUser,
				ClientParams: authn.ClientParams{
					FetchPermissionsParams: authn.FetchPermissionsParams{
						RestrictedActions: []string{
							"datasources:read",
							"datasources:query",
						},
						AllowedActions: []string{
							"datasources:write",
						},
						Roles: []string{
							"fixed:datasources:writer",
						},
					},
				},
			},
		},
		{
			desc: "should succeed with authentication for second client when first test fail",
			clients: []authn.Client{
				&authntest.FakeClient{ExpectedName: "1", ExpectedPriority: 1, ExpectedTest: false},
				&authntest.FakeClient{
					ExpectedName:     "2",
					ExpectedPriority: 2,
					ExpectedTest:     true,
					ExpectedIdentity: &authn.Identity{ID: "2", Type: claims.TypeUser, AuthID: "service:some-service", AuthenticatedBy: "service_auth"},
				},
			},
			expectedIdentity: &authn.Identity{ID: "2", Type: claims.TypeUser, AuthID: "service:some-service", AuthenticatedBy: "service_auth"},
		},
		{
			desc: "should succeed with authentication for third client when error happened in first",
			clients: []authn.Client{
				&authntest.FakeClient{ExpectedName: "1", ExpectedPriority: 2, ExpectedTest: false},
				&authntest.FakeClient{ExpectedName: "2", ExpectedPriority: 1, ExpectedTest: true, ExpectedErr: errors.New("some error")},
				&authntest.FakeClient{ExpectedName: "3", ExpectedPriority: 3, ExpectedTest: true, ExpectedIdentity: &authn.Identity{ID: "3", Type: claims.TypeUser}},
			},
			expectedIdentity: &authn.Identity{ID: "3", Type: claims.TypeUser},
		},
		{
			desc: "should return error when no client could authenticate the request",
			clients: []authn.Client{
				&authntest.FakeClient{ExpectedName: "1", ExpectedPriority: 2, ExpectedTest: false},
				&authntest.FakeClient{ExpectedName: "2", ExpectedPriority: 1, ExpectedTest: false},
				&authntest.FakeClient{ExpectedName: "3", ExpectedPriority: 3, ExpectedTest: false},
			},
			expectedErrors: []error{errCantAuthenticateReq},
		},
		{
			desc: "should return all errors in chain",
			clients: []authn.Client{
				&authntest.FakeClient{ExpectedName: "1", ExpectedPriority: 2, ExpectedTest: false},
				&authntest.FakeClient{ExpectedName: "2", ExpectedPriority: 1, ExpectedTest: true, ExpectedErr: firstErr},
				&authntest.FakeClient{ExpectedName: "3", ExpectedPriority: 3, ExpectedTest: true, ExpectedErr: lastErr},
			},
			expectedErrors: []error{firstErr, lastErr},
		},
		{
			desc: "should return error on disabled identity",
			clients: []authn.Client{
				&authntest.FakeClient{ExpectedName: "1", ExpectedTest: true, ExpectedIdentity: &authn.Identity{IsDisabled: true}},
			},
			expectedErrors: []error{errDisabledIdentity},
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			spanRecorder := tracetest.NewSpanRecorder()
			tracer := tracing.InitializeTracerForTest(tracing.WithSpanProcessor(spanRecorder))

			svc := setupTests(t, func(svc *Service) {
				svc.tracer = tracer

				for _, c := range tt.clients {
					svc.RegisterClient(c)
				}
			})

			identity, err := svc.Authenticate(context.Background(), &authn.Request{})
			spans := spanRecorder.Ended()
			if len(tt.expectedErrors) == 0 {
				assert.NoError(t, err)
				assert.EqualValues(t, tt.expectedIdentity, identity)

				matchedClients := make([]*authntest.FakeClient, 0)
				for _, client := range tt.clients {
					fakeClient, _ := client.(*authntest.FakeClient)
					if fakeClient.ExpectedTest {
						matchedClients = append(matchedClients, fakeClient)
					}
				}
				require.Len(t, spans, 1+len(matchedClients), "must have spans 1+ number of clients tried")

				spansTested := make([]sdktrace.ReadOnlySpan, 0)
				for _, span := range spans {
					if span.Name() != "authn.Authenticate" {
						spansTested = append(spansTested, span)
					}
				}

				assert.Len(t, spansTested, len(matchedClients), "expected spans with name authn.authenticate to match number of clients tested")

				// since this is a success case, at least one span should have all 3 attributes
				passedAuthnIndex := slices.IndexFunc(spansTested, func(span sdktrace.ReadOnlySpan) bool {
					return len(span.Attributes()) >= 3 // more than 3 when there are ClientParams in the identity
				})
				require.NotEqual(t, -1, passedAuthnIndex, "no spans found all 3 attributes - passed case should have authn attributes set")
				passedAuthnSpan := spansTested[passedAuthnIndex]
				for _, attr := range passedAuthnSpan.Attributes() {
					switch attr.Key {
					case "identity.ID":
						assert.Equal(t, tt.expectedIdentity.GetID(), attr.Value.AsString())
					case "identity.AuthID":
						assert.Equal(t, tt.expectedIdentity.AuthID, attr.Value.AsString())
					case "identity.AuthenticatedBy":
						assert.Equal(t, tt.expectedIdentity.AuthenticatedBy, attr.Value.AsString())
					case "identity.ClientParams.FetchPermissionsParams.RestrictedActions":
						if len(tt.expectedIdentity.ClientParams.FetchPermissionsParams.RestrictedActions) > 0 {
							assert.Equal(t, tt.expectedIdentity.ClientParams.FetchPermissionsParams.RestrictedActions, attr.Value.AsStringSlice())
						}
					case "identity.ClientParams.FetchPermissionsParams.AllowedActions":
						if len(tt.expectedIdentity.ClientParams.FetchPermissionsParams.AllowedActions) > 0 {
							assert.Equal(t, tt.expectedIdentity.ClientParams.FetchPermissionsParams.AllowedActions, attr.Value.AsStringSlice())
						}
					case "identity.ClientParams.FetchPermissionsParams.Roles":
						if len(tt.expectedIdentity.ClientParams.FetchPermissionsParams.Roles) > 0 {
							assert.Equal(t, tt.expectedIdentity.ClientParams.FetchPermissionsParams.Roles, attr.Value.AsStringSlice())
						}
					}
				}

				if len(matchedClients) > 1 {
					failedAuthnIndex := slices.IndexFunc(spansTested, func(span sdktrace.ReadOnlySpan) bool {
						return span.Status().Code == codes.Error
					})
					assert.NotEqual(t, -1, failedAuthnIndex, "no spans found for the error case - at least one client in multi client test must have failed")
				}
			} else {
				for _, e := range tt.expectedErrors {
					assert.ErrorIs(t, err, e)
				}
				assert.Nil(t, identity)
			}
		})
	}
}

func TestService_OrgID(t *testing.T) {
	type TestCase struct {
		desc          string
		req           *authn.Request
		expectedOrgID int64
	}

	tests := []TestCase{
		{
			desc: "should set org id when present in header",
			req: &authn.Request{HTTPRequest: &http.Request{
				Header: map[string][]string{orgIDHeaderName: {"1"}},
				URL:    &url.URL{},
			}},
			expectedOrgID: 1,
		},
		{
			desc: "should set org id when present in url",
			req: &authn.Request{HTTPRequest: &http.Request{
				Header: map[string][]string{},
				URL:    mustParseURL("http://localhost/?targetOrgId=2"),
			}},
			expectedOrgID: 2,
		},
		{
			desc: "should prioritise org id from url when present in both header and url",
			req: &authn.Request{HTTPRequest: &http.Request{
				Header: map[string][]string{orgIDHeaderName: {"1"}},
				URL:    mustParseURL("http://localhost/?targetOrgId=2"),
			}},
			expectedOrgID: 2,
		},
		{
			desc: "should set org id to 0 when missing in both header and url",
			req: &authn.Request{HTTPRequest: &http.Request{
				Header: map[string][]string{},
				URL:    &url.URL{},
			}},
			expectedOrgID: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			var calledWith int64
			s := setupTests(t, func(svc *Service) {
				svc.RegisterClient(authntest.MockClient{
					AuthenticateFunc: func(ctx context.Context, r *authn.Request) (*authn.Identity, error) {
						calledWith = r.OrgID
						return &authn.Identity{}, nil
					},
					TestFunc: func(ctx context.Context, r *authn.Request) bool { return true },
				})
			})

			_, _ = s.Authenticate(context.Background(), tt.req)
			assert.Equal(t, tt.expectedOrgID, calledWith)
		})
	}
}

func TestService_HookClient(t *testing.T) {
	hookCalled := false

	s := setupTests(t, func(svc *Service) {
		svc.RegisterClient(&authntest.MockClient{
			AuthenticateFunc: func(ctx context.Context, r *authn.Request) (*authn.Identity, error) {
				return &authn.Identity{}, nil
			},
			TestFunc: func(ctx context.Context, r *authn.Request) bool {
				return true
			},
			HookFunc: func(ctx context.Context, identity *authn.Identity, r *authn.Request) error {
				hookCalled = true
				return nil
			},
		})
	})

	_, _ = s.Authenticate(context.Background(), &authn.Request{})
	require.True(t, hookCalled)
}

func TestService_Login(t *testing.T) {
	type TestCase struct {
		desc   string
		client string

		expectedClientOK       bool
		expectedClientErr      error
		expectedClientIdentity *authn.Identity

		expectedSessionErr error

		expectedErr      error
		expectedIdentity *authn.Identity
	}

	tests := []TestCase{
		{
			desc:             "should login for valid request",
			client:           "fake",
			expectedClientOK: true,
			expectedClientIdentity: &authn.Identity{
				ID:   "1",
				Type: claims.TypeUser,
			},
			expectedIdentity: &authn.Identity{
				ID:           "1",
				Type:         claims.TypeUser,
				SessionToken: &auth.UserToken{UserId: 1},
			},
		},
		{
			desc:        "should not login with invalid client",
			client:      "invalid",
			expectedErr: authn.ErrClientNotConfigured,
		},
		{
			desc:                   "should not login non user identity",
			client:                 "fake",
			expectedClientOK:       true,
			expectedClientIdentity: &authn.Identity{ID: "1", Type: claims.TypeAPIKey},
			expectedErr:            authn.ErrUnsupportedIdentity,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			s := setupTests(t, func(svc *Service) {
				svc.RegisterClient(&authntest.FakeClient{
					ExpectedName:     "fake",
					ExpectedErr:      tt.expectedClientErr,
					ExpectedTest:     tt.expectedClientOK,
					ExpectedIdentity: tt.expectedClientIdentity,
				})
				svc.sessionService = &authtest.FakeUserAuthTokenService{
					CreateTokenProvider: func(ctx context.Context, cmd *auth.CreateTokenCommand) (*auth.UserToken, error) {
						if tt.expectedSessionErr != nil {
							return nil, tt.expectedSessionErr
						}
						return &auth.UserToken{UserId: cmd.User.ID}, nil
					},
				}
			})

			identity, err := s.Login(context.Background(), tt.client, &authn.Request{HTTPRequest: &http.Request{
				Header: map[string][]string{},
				URL:    &url.URL{},
			}})
			assert.ErrorIs(t, err, tt.expectedErr)
			assert.EqualValues(t, tt.expectedIdentity, identity)
		})
	}
}

func TestService_RedirectURL(t *testing.T) {
	type testCase struct {
		desc        string
		client      string
		expectedErr error
	}

	tests := []testCase{
		{
			desc:   "should generate url for valid redirect client",
			client: "redirect",
		},
		{
			desc:        "should return error on non existing client",
			client:      "non-existing",
			expectedErr: authn.ErrClientNotConfigured,
		},
		{
			desc:        "should return error when client don't support the redirect interface",
			client:      "non-redirect",
			expectedErr: authn.ErrUnsupportedClient,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			service := setupTests(t, func(svc *Service) {
				svc.RegisterClient(authntest.FakeRedirectClient{ExpectedName: "redirect"})
				svc.RegisterClient(&authntest.FakeClient{ExpectedName: "non-redirect"})
			})

			_, err := service.RedirectURL(context.Background(), tt.client, nil)
			assert.ErrorIs(t, err, tt.expectedErr)
		})
	}
}

func TestService_Logout(t *testing.T) {
	type TestCase struct {
		desc string

		identity     *authn.Identity
		sessionToken *usertoken.UserToken

		client             authn.Client
		signoutRedirectURL string

		expectedErr          error
		expectedTokenRevoked bool
		expectedRedirect     *authn.Redirect
	}

	tests := []TestCase{
		{
			desc:             "should redirect to default redirect url when identity is not a user",
			identity:         &authn.Identity{ID: "1", Type: claims.TypeServiceAccount},
			expectedRedirect: &authn.Redirect{URL: "http://localhost:3000/login"},
		},
		{
			desc:                 "should redirect to default redirect url when no external provider was used to authenticate",
			identity:             &authn.Identity{ID: "1", Type: claims.TypeUser},
			expectedRedirect:     &authn.Redirect{URL: "http://localhost:3000/login"},
			expectedTokenRevoked: true,
		},
		{
			desc:                 "should redirect to default redirect url when client is not found",
			identity:             &authn.Identity{ID: "1", Type: claims.TypeUser, AuthenticatedBy: "notfound"},
			expectedRedirect:     &authn.Redirect{URL: "http://localhost:3000/login"},
			expectedTokenRevoked: true,
		},
		{
			desc:                 "should redirect to default redirect url when client do not implement logout extension",
			identity:             &authn.Identity{ID: "1", Type: claims.TypeUser, AuthenticatedBy: "azuread"},
			expectedRedirect:     &authn.Redirect{URL: "http://localhost:3000/login"},
			client:               &authntest.FakeClient{ExpectedName: "auth.client.azuread"},
			expectedTokenRevoked: true,
		},
		{
			desc:                 "should use signout redirect url if configured",
			identity:             &authn.Identity{ID: "1", Type: claims.TypeUser, AuthenticatedBy: "azuread"},
			expectedRedirect:     &authn.Redirect{URL: "some-url"},
			client:               &authntest.FakeClient{ExpectedName: "auth.client.azuread"},
			signoutRedirectURL:   "some-url",
			expectedTokenRevoked: true,
		},
		{
			desc:             "should redirect to client specific url",
			identity:         &authn.Identity{ID: "1", Type: claims.TypeUser, AuthenticatedBy: "azuread"},
			expectedRedirect: &authn.Redirect{URL: "http://idp.com/logout"},
			client: &authntest.MockClient{
				NameFunc: func() string { return "auth.client.azuread" },
				LogoutFunc: func(ctx context.Context, _ identity.Requester, sessionToken *usertoken.UserToken) (*authn.Redirect, bool) {
					return &authn.Redirect{URL: "http://idp.com/logout"}, true
				},
			},
			expectedTokenRevoked: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			var tokenRevoked bool

			s := setupTests(t, func(svc *Service) {
				if tt.client != nil {
					svc.RegisterClient(tt.client)
				}
				svc.cfg.AppSubURL = "http://localhost:3000"

				svc.sessionService = &authtest.FakeUserAuthTokenService{
					RevokeTokenProvider: func(_ context.Context, sessionToken *auth.UserToken, soft bool) error {
						tokenRevoked = true
						assert.EqualValues(t, tt.sessionToken, sessionToken)
						assert.False(t, soft)
						return nil
					},
				}

				if tt.signoutRedirectURL != "" {
					svc.cfg.SignoutRedirectUrl = tt.signoutRedirectURL
				}
			})

			redirect, err := s.Logout(context.Background(), tt.identity, tt.sessionToken)

			assert.ErrorIs(t, err, tt.expectedErr)
			assert.EqualValues(t, tt.expectedRedirect, redirect)
			assert.Equal(t, tt.expectedTokenRevoked, tokenRevoked)
		})
	}
}

func TestService_ResolveIdentity(t *testing.T) {
	t.Run("should return error for for unknown namespace", func(t *testing.T) {
		svc := setupTests(t)
		_, err := svc.ResolveIdentity(context.Background(), 1, "some:1")
		assert.ErrorIs(t, err, authn.ErrUnsupportedIdentity)
	})

	t.Run("should return error for for namespace that don't have a resolver", func(t *testing.T) {
		svc := setupTests(t)
		_, err := svc.ResolveIdentity(context.Background(), 1, "api-key:1")
		assert.ErrorIs(t, err, authn.ErrUnsupportedIdentity)
	})

	t.Run("should resolve for user", func(t *testing.T) {
		svc := setupTests(t)
		identity, err := svc.ResolveIdentity(context.Background(), 1, "user:1")
		assert.NoError(t, err)
		assert.NotNil(t, identity)
	})

	t.Run("should resolve for service account", func(t *testing.T) {
		svc := setupTests(t)
		identity, err := svc.ResolveIdentity(context.Background(), 1, "service-account:1")
		assert.NoError(t, err)
		assert.NotNil(t, identity)
	})

	t.Run("should resolve for valid namespace if client is registered", func(t *testing.T) {
		svc := setupTests(t, func(svc *Service) {
			svc.RegisterClient(&authntest.MockClient{
				IdentityTypeFunc: func() claims.IdentityType { return claims.TypeAPIKey },
				ResolveIdentityFunc: func(_ context.Context, _ int64, _ claims.IdentityType, _ string) (*authn.Identity, error) {
					return &authn.Identity{}, nil
				},
			})
		})

		identity, err := svc.ResolveIdentity(context.Background(), 1, "api-key:1")
		assert.NoError(t, err)
		assert.NotNil(t, identity)
	})
}

func mustParseURL(s string) *url.URL {
	u, err := url.Parse(s)
	if err != nil {
		panic(err)
	}
	return u
}

func setupTests(t *testing.T, opts ...func(svc *Service)) *Service {
	t.Helper()

	s := &Service{
		log:                    log.NewNopLogger(),
		cfg:                    setting.NewCfg(),
		clients:                make(map[string]authn.Client),
		clientQueue:            newQueue[authn.ContextAwareClient](),
		idenityResolverClients: make(map[string]authn.IdentityResolverClient),
		tracer:                 tracing.InitializeTracerForTest(),
		metrics:                newMetrics(nil),
		postAuthHooks:          newQueue[authn.PostAuthHookFn](),
		postLoginHooks:         newQueue[authn.PostLoginHookFn](),
		preLogoutHooks:         newQueue[authn.PreLogoutHookFn](),
	}

	for _, o := range opts {
		o(s)
	}

	return s
}
