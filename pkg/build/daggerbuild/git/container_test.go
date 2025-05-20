package git

import (
	"testing"
)

func TestInjectURLCredentials(t *testing.T) {
	expected := "https://username:password@example.org/somepath?query=param"
	input := "https://example.org/somepath?query=param"
	output, err := injectURLCredentials(input, "username", "password")
	if err != nil {
		t.Fatal("Unexpected error from injectURLCredentials:", err)
	}
	if expected != output {
		t.Fatalf("Unexpected output. Expected '%s', got '%s'", expected, output)
	}
}
