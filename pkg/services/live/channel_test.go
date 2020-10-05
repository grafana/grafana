package live

import (
	"testing"

	"github.com/google/go-cmp/cmp"
)

func TestParseChannelIdentifier(t *testing.T) {
	ident, err := ParseChannelIdentifier("aaa/bbb/ccc/ddd")
	if err != nil {
		t.FailNow()
	}

	ex := ChannelIdentifier{
		Scope:     "aaa",
		Namespace: "bbb",
		Path:      "ccc/ddd",
	}

	if diff := cmp.Diff(ident, ex); diff != "" {
		t.Fatalf("Result mismatch (-want +got):\n%s", diff)
	}

	// Check an invalid identifier
	_, err = ParseChannelIdentifier("aaa/bbb")
	if err == nil {
		t.FailNow()
	}
}
