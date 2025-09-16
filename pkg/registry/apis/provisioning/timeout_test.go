package provisioning

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestWithTimeout(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		select {
		case <-r.Context().Done():
			w.WriteHeader(http.StatusGatewayTimeout)
		case <-time.After(50 * time.Millisecond):
			w.WriteHeader(http.StatusOK)
		}
	})

	tests := []struct {
		name       string
		timeout    time.Duration
		wantStatus int
	}{
		{
			name:       "request completes",
			timeout:    100 * time.Millisecond,
			wantStatus: http.StatusOK,
		},
		{
			name:       "request times out",
			timeout:    10 * time.Millisecond,
			wantStatus: http.StatusGatewayTimeout,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			r := httptest.NewRequest("GET", "/", nil)
			WithTimeout(handler, tt.timeout).ServeHTTP(w, r)

			if w.Code != tt.wantStatus {
				t.Errorf("withTimeout() status = %v, want %v", w.Code, tt.wantStatus)
			}
		})
	}
}
