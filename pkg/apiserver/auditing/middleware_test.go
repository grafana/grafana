package auditing

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/audit"
)

func TestHTTPInjectAuditAnnotationMiddleware(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name           string
		authInfo       types.AuthInfo
		wantAnnotation string
		wantPresent    bool
	}{
		{
			name: "single innermostServiceIdentity value is injected as the audit annotation",
			authInfo: &fakeAuthInfo{extra: map[string][]string{
				"innermostServiceIdentity": {"my-service"},
			}},
			wantAnnotation: "my-service",
			wantPresent:    true,
		},
		{
			name: "only the first value is used when multiple are present",
			authInfo: &fakeAuthInfo{extra: map[string][]string{
				"innermostServiceIdentity": {"first", "second"},
			}},
			wantAnnotation: "first",
			wantPresent:    true,
		},
		{
			name: "extras without the innermostServiceIdentity key: no annotation",
			authInfo: &fakeAuthInfo{extra: map[string][]string{
				"some-other-key": {"value"},
			}},
			wantPresent: false,
		},
		{
			name: "empty slice for the key: no annotation",
			authInfo: &fakeAuthInfo{extra: map[string][]string{
				"innermostServiceIdentity": {},
			}},
			wantPresent: false,
		},
		{
			name:        "nil extras map: no annotation",
			authInfo:    &fakeAuthInfo{extra: nil},
			wantPresent: false,
		},
		{
			name:        "no auth info on the request: no annotation",
			authInfo:    nil,
			wantPresent: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			req := httptest.NewRequest(http.MethodGet, "/some/path", nil)
			ctx := audit.WithAuditContext(req.Context())
			if tt.authInfo != nil {
				ctx = types.WithAuthInfo(ctx, tt.authInfo)
			}
			req = req.WithContext(ctx)

			nextCalled := false
			handler := HTTPInjectAuditAnnotationMiddleware(http.HandlerFunc(func(_ http.ResponseWriter, _ *http.Request) {
				nextCalled = true
			}))
			handler.ServeHTTP(httptest.NewRecorder(), req)

			require.True(t, nextCalled, "next handler must always be invoked")

			ac := audit.AuditContextFrom(ctx)
			require.NotNil(t, ac)
			got, ok := ac.GetEventAnnotation(AuditAnnotationInnermostServiceIdentity)
			require.Equal(t, tt.wantPresent, ok)
			if tt.wantPresent {
				require.Equal(t, tt.wantAnnotation, got)
			}
		})
	}
}

type fakeAuthInfo struct {
	types.AuthInfo
	extra map[string][]string
}

func (f *fakeAuthInfo) GetExtra() map[string][]string { return f.extra }
