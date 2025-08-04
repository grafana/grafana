package main

import "testing"

func TestArtifactsPage(t *testing.T) {
	expect := "https://dl.grafana.com/private/a1b2c3d4/v1.2.3+security-01.html"
	u := pageURL("a1b2c3d4e5f6g7h8", "v1.2.3+security-01")

	if expect != u.String() {
		t.Fatalf("unexpect url: %s; expected %s", u.String(), expect)
	}
}
