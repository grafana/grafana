package filters

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

func TestWithTransactionContextFallback(t *testing.T) {
	tests := []struct {
		name          string
		ctx           func() context.Context
		wantTargeting string
	}{
		{
			name:          "no request info, no identity: leaves context empty",
			ctx:           func() context.Context { return context.Background() },
			wantTargeting: "",
		},
		{
			name: "namespace from apiserver request info",
			ctx: func() context.Context {
				return request.WithRequestInfo(context.Background(), &request.RequestInfo{Namespace: "stacks-42"})
			},
			wantTargeting: "stacks-42",
		},
		{
			name: "wildcard request info namespace falls back to identity",
			ctx: func() context.Context {
				ctx := request.WithRequestInfo(context.Background(), &request.RequestInfo{Namespace: "*"})
				return identity.WithRequester(ctx, &identity.StaticRequester{Namespace: "stacks-7"})
			},
			wantTargeting: "stacks-7",
		},
		{
			name: "no request info, namespace from identity",
			ctx: func() context.Context {
				return identity.WithRequester(context.Background(), &identity.StaticRequester{Namespace: "stacks-7"})
			},
			wantTargeting: "stacks-7",
		},
		{
			name: "wildcard identity namespace is not used",
			ctx: func() context.Context {
				return identity.WithRequester(context.Background(), &identity.StaticRequester{Namespace: "*"})
			},
			wantTargeting: "",
		},
		{
			name: "existing transaction context (e.g. from baggage) is not overridden",
			ctx: func() context.Context {
				ctx := request.WithRequestInfo(context.Background(), &request.RequestInfo{Namespace: "stacks-42"})
				existing := openfeature.NewEvaluationContext("stacks-1", nil)
				return openfeature.WithTransactionContext(ctx, existing)
			},
			wantTargeting: "stacks-1",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			var capturedCtx context.Context
			next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				capturedCtx = r.Context()
			})

			handler := WithTransactionContextFallback(next)
			req := httptest.NewRequest(http.MethodGet, "/", nil)
			req = req.WithContext(tc.ctx())
			handler.ServeHTTP(httptest.NewRecorder(), req)

			require.NotNil(t, capturedCtx)
			assert.Equal(t, tc.wantTargeting, openfeature.TransactionContext(capturedCtx).TargetingKey())
		})
	}
}
