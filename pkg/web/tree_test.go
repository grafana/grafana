package web

import (
	"net/http"
	"testing"
)

func TestTreeMatchesProjectIDEnvelopeRoute(t *testing.T) {
	handle := Handle(func(http.ResponseWriter, *http.Request, map[string]string) {})
	tree := NewTree()
	tree.Add("/api/:projectID/envelope/", handle)

	matched, params, ok := tree.Match("/api/1/envelope/")
	if !ok {
		t.Fatal("expected envelope route to match")
	}
	if matched == nil {
		t.Fatal("expected envelope route handler")
	}
	if got := params[":projectID"]; got != "1" {
		t.Fatalf("expected projectID 1, got %q", got)
	}
}
