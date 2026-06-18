package api

import (
	"errors"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// proxyErrResponse maps errors from the annotation API server to HTTP responses. Proxy
// routing itself is covered by the migration repository's unit tests.
func TestProxyErrResponse(t *testing.T) {
	statusErr := func(code int32) error {
		return &k8serrors.StatusError{ErrStatus: metav1.Status{Code: code, Message: "msg"}}
	}

	tests := []struct {
		name       string
		err        error
		wantStatus int
	}{
		{name: "4xx forwarded to caller", err: statusErr(400), wantStatus: http.StatusBadRequest},
		{name: "422 forwarded to caller", err: statusErr(422), wantStatus: http.StatusUnprocessableEntity},
		{name: "401 hidden as 500 (service token misconfigured)", err: statusErr(401), wantStatus: http.StatusInternalServerError},
		{name: "403 hidden as 500 (service token misconfigured)", err: statusErr(403), wantStatus: http.StatusInternalServerError},
		{name: "5xx returned as 500", err: statusErr(500), wantStatus: http.StatusInternalServerError},
		{name: "non-status error returned as 500", err: errors.New("boom"), wantStatus: http.StatusInternalServerError},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp := proxyErrResponse("failed", tt.err)
			require.Equal(t, tt.wantStatus, resp.Status())
		})
	}
}
