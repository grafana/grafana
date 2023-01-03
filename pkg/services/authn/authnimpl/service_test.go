package authnimpl

import (
	"context"
	"errors"
	"net/http"
	"net/url"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/authn/authntest"
	"github.com/grafana/grafana/pkg/setting"
)

func TestService_Authenticate(t *testing.T) {
	type TestCase struct {
		desc        string
		clientName  string
		expectedOK  bool
		expectedErr error
	}

	tests := []TestCase{
		{
			desc:       "should succeed with authentication for configured client",
			clientName: "fake",
			expectedOK: true,
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
			expectedErr: errors.New("some error"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			svc := setupTests(t, func(svc *Service) {
				svc.clients["fake"] = &authntest.FakeClient{
					ExpectedErr:  tt.expectedErr,
					ExpectedTest: tt.expectedOK,
				}
			})

			_, ok, err := svc.Authenticate(context.Background(), tt.clientName, &authn.Request{})
			assert.Equal(t, tt.expectedOK, ok)
			if tt.expectedErr != nil {
				assert.Error(t, err)
			}
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
						return nil, nil
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
