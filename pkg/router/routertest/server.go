package routertest

import (
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
)

type Server struct {
	*httptest.Server
	mu     sync.Mutex
	tokens map[string]string
}

func (s *Server) AccessToken(path string) string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.tokens[path]
}

func NewServer(t testing.TB, responses map[string]string) *Server {
	t.Helper()
	s := &Server{tokens: make(map[string]string)}
	s.Server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		response, ok := responses[r.URL.Path]
		if !ok {
			t.Errorf("unexpected router request: %s", r.URL.Path)
			http.NotFound(w, r)
			return
		}
		s.mu.Lock()
		s.tokens[r.URL.Path] = r.Header.Get("X-Access-Token")
		s.mu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(response))
	}))
	t.Cleanup(s.Close)
	return s
}
