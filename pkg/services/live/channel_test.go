package live

import (
	"testing"

	"github.com/google/go-cmp/cmp"
)

func TestParseChannelAddress(t *testing.T) {
	addr := ParseChannelAddress("aaa/bbb/ccc/ddd")
	if !addr.IsValid() {
		t.FailNow()
	}

	ex := ChannelAddress{
		Scope:     "aaa",
		Namespace: "bbb",
		Path:      "ccc/ddd",
	}

	if diff := cmp.Diff(addr, ex); diff != "" {
		t.Fatalf("Result mismatch (-want +got):\n%s", diff)
	}

	// Check an invalid identifier
	addr = ParseChannelAddress("aaa/bbb")
	if addr.IsValid() {
		t.FailNow()
	}
}
