package web

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestDefaultWrapHandlerHTTP(t *testing.T) {
	m := New()
	m.Get("/x", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusTeapot)
	})

	rec := httptest.NewRecorder()
	m.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/x", nil))
	if rec.Code != http.StatusTeapot {
		t.Fatalf("got status %d, want %d", rec.Code, http.StatusTeapot)
	}
}

func TestWrapHandlerRequiresRegistrationForUnknownTypes(t *testing.T) {
	defer func() {
		if recover() == nil {
			t.Fatal("expected panic for unknown handler type")
		}
	}()
	_ = wrapHandler(42)
}
