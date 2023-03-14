package authnimpl

import (
	"context"
	"errors"
	"net"
	"net/http"
	"net/url"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/auth/authtest"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/authn/authntest"
	"github.com/grafana/grafana/pkg/services/user"
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
				&authntest.FakeClient{ExpectedTest: true, ExpectedIdentity: &authn.Identity{ID: "user:1"}},
			},
			expectedIdentity: &authn.Identity{ID: "user:1"},
		},
		{
			desc: "should succeed with authentication for second client when first test fail",
			clients: []authn.Client{
				&authntest.FakeClient{ExpectedName: "1", ExpectedPriority: 1, ExpectedTest: false},
				&authntest.FakeClient{ExpectedName: "2", ExpectedPriority: 2, ExpectedTest: true, ExpectedIdentity: &authn.Identity{ID: "user:2"}},
			},
			expectedIdentity: &authn.Identity{ID: "user:2"},
		},
		{
			desc: "should succeed with authentication for third client when error happened in first",
			clients: []authn.Client{
				&authntest.FakeClient{ExpectedName: "1", ExpectedPriority: 2, ExpectedTest: false},
				&authntest.FakeClient{ExpectedName: "2", ExpectedPriority: 1, ExpectedTest: true, ExpectedErr: errors.New("some error")},
				&authntest.FakeClient{ExpectedName: "3", ExpectedPriority: 3, ExpectedTest: true, ExpectedIdentity: &authn.Identity{ID: "user:3"}},
			},
			expectedIdentity: &authn.Identity{ID: "user:3"},
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
			svc := setupTests(t, func(svc *Service) {
				for _, c := range tt.clients {
					svc.RegisterClient(c)
				}
			})

			identity, err := svc.Authenticate(context.Background(), &authn.Request{})
			if len(tt.expectedErrors) == 0 {
				assert.NoError(t, err)
				assert.EqualValues(t, tt.expectedIdentity, identity)
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
				ID: "user:1",
			},
			expectedIdentity: &authn.Identity{
				ID:           "user:1",
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
			expectedClientIdentity: &authn.Identity{ID: "apikey:1"},
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
					CreateTokenProvider: func(ctx context.Context, user *user.User, clientIP net.IP, userAgent string) (*auth.UserToken, error) {
						if tt.expectedSessionErr != nil {
							return nil, tt.expectedSessionErr
						}
						return &auth.UserToken{UserId: user.ID}, nil
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
		log:            log.NewNopLogger(),
		cfg:            setting.NewCfg(),
		clients:        map[string]authn.Client{},
		clientQueue:    newQueue[authn.ContextAwareClient](),
		tracer:         tracing.InitializeTracerForTest(),
		metrics:        newMetrics(nil),
		postAuthHooks:  newQueue[authn.PostAuthHookFn](),
		postLoginHooks: newQueue[authn.PostLoginHookFn](),
	}

	for _, o := range opts {
		o(s)
	}

	return s
}
