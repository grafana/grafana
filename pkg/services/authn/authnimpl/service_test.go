package authnimpl

import (
	"context"
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
		expectedErr error
	}

	tests := []TestCase{
		{
			desc:       "should succeed with authentication for configured client",
			clientName: "fake",
		},
		{
			desc:        "should fail when client is not configured",
			clientName:  "gitlab",
			expectedErr: authn.ErrClientNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			svc := setupTests(t, func(svc *Service) {
				svc.clients["fake"] = &authntest.FakeClient{}
			})

			_, err := svc.Authenticate(context.Background(), tt.clientName, &authn.Request{})
			assert.ErrorIs(t, tt.expectedErr, err)
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
