package authnimpl

import (
	"context"
	"errors"
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
