package live

import (
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/require"
)

func TestParseChannelAddress(t *testing.T) {
	addr := ParseChannelAddress("aaa/bbb/ccc/ddd")
	require.True(t, addr.IsValid())

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
	require.True(t, addr.IsValid())
}
