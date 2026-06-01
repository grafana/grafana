package docker

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/moby/moby/client"
)

func TestHandleListContainers(t *testing.T) {
	t.Run("returns trimmed container list", func(t *testing.T) {
		fake := &fakeDockerClient{
			containerList: client.ContainerListResult{},
		}
		s := newTestService(fake)
		mux := s.newResourceMux()

		req := httptest.NewRequest(http.MethodGet, "/containers", nil)
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("status: got %d, want 200. body: %s", rec.Code, rec.Body.String())
		}

		var out []GetContainers
		if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
			t.Fatalf("unmarshal response: %v", err)
		}
	})

	t.Run("SDK error returns 502", func(t *testing.T) {
		fake := &fakeDockerClient{listErr: errors.New("daemon down")}
		s := newTestService(fake)
		mux := s.newResourceMux()

		req := httptest.NewRequest(http.MethodGet, "/containers", nil)
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, req)

		if rec.Code != http.StatusBadGateway {
			t.Errorf("status: got %d, want 502", rec.Code)
		}
	})
}
