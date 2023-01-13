package authnimpl

import (
	"context"
	"errors"
	"net"
	"net/http"
	"net/url"
	"testing"

	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/auth/authtest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/authn/authntest"
	"github.com/grafana/grafana/pkg/setting"
)

func TestService_Authenticate(t *testing.T) {
	type TestCase struct {
		desc           string
		clientName     string
		clientErr      error
		clientIdentity *authn.Identity
		expectedOK     bool
		expectedErr    error
	}

	var clientErr = errors.New("some err")

	tests := []TestCase{
		{
			desc:           "should succeed with authentication for configured client",
			clientIdentity: &authn.Identity{},
			clientName:     "fake",
			expectedOK:     true,
		},
		{
			desc:       "should return false when client is not configured",
			clientName: "gitlab",
			expectedOK: false,
		},
		{
			desc:        "should return true and error when client could be used but failed to authenticate",
			clientName:  "fake",
			expectedOK:  true,
			clientErr:   clientErr,
			expectedErr: clientErr,
		},
		{
			desc:           "should return error if identity is disabled",
			clientName:     "fake",
			clientIdentity: &authn.Identity{IsDisabled: true},
			expectedOK:     true,
			expectedErr:    errDisabledIdentity,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			svc := setupTests(t, func(svc *Service) {
				svc.clients["fake"] = &authntest.FakeClient{
					ExpectedIdentity: tt.clientIdentity,
					ExpectedErr:      tt.clientErr,
					ExpectedTest:     tt.expectedOK,
				}
			})

			_, ok, err := svc.Authenticate(context.Background(), tt.clientName, &authn.Request{})
			assert.Equal(t, tt.expectedOK, ok)
			assert.ErrorIs(t, err, tt.expectedErr)
		})
	}
}

func TestService_AuthenticateOrgID(t *testing.T) {
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
				svc.clients["fake"] = authntest.MockClient{
					AuthenticateFunc: func(ctx context.Context, r *authn.Request) (*authn.Identity, error) {
						calledWith = r.OrgID
						return &authn.Identity{}, nil
					},
					TestFunc: func(ctx context.Context, r *authn.Request) bool {
						return true
					},
				}
			})

			_, _, _ = s.Authenticate(context.Background(), "fake", tt.req)
			assert.Equal(t, tt.expectedOrgID, calledWith)
		})
	}
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
			desc:             "should authenticate and create session for valid request",
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
			desc:        "should not authenticate with invalid client",
			client:      "invalid",
			expectedErr: authn.ErrClientNotConfigured,
		},
		{
			desc:                   "should not authenticate non user identity",
			client:                 "fake",
			expectedClientOK:       true,
			expectedClientIdentity: &authn.Identity{ID: "apikey:1"},
			expectedErr:            authn.ErrUnsupportedIdentity,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			s := setupTests(t, func(svc *Service) {
				svc.clients["fake"] = &authntest.FakeClient{
					ExpectedErr:      tt.expectedClientErr,
					ExpectedTest:     tt.expectedClientOK,
					ExpectedIdentity: tt.expectedClientIdentity,
				}
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
		log:     log.NewNopLogger(),
		cfg:     setting.NewCfg(),
		clients: map[string]authn.Client{},
		tracer:  tracing.InitializeTracerForTest(),
	}

	for _, o := range opts {
		o(s)
	}

	return s
}
