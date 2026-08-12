package resource

import (
	"reflect"
	"testing"
)

// Fuzzes the base64+JSON pagination token parser. Clients control the
// input and the parser runs on every paginated list request, so panics
// or pathological allocations would hit a request handler. Round-trip:
// any token that parses must re-parse to an equal value.
func FuzzGetContinueToken(f *testing.F) {
	// Real tokens (round-trip-able), plus a few adversarial shapes.
	seeds := []ContinueToken{
		{ResourceVersion: 0},
		{Namespace: "ns", Name: "n", ResourceVersion: 42},
		{Name: "n", ResourceVersion: 100, SortAscending: true},
		{ResourceVersion: 1, SearchAfter: []string{"a", "b"}},
		{ResourceVersion: 1, SearchBefore: []string{"a", "b"}},
	}
	for _, s := range seeds {
		f.Add([]byte(s.String()))
	}
	// Junk that exercises the base64/json error paths.
	f.Add([]byte(""))
	f.Add([]byte("!!!not-base64!!!"))
	f.Add([]byte("e30=")) // base64("{}")

	f.Fuzz(func(t *testing.T, data []byte) {
		tok, err := GetContinueToken(string(data))
		if err != nil {
			return
		}
		tok2, err := GetContinueToken(tok.String())
		if err != nil {
			t.Fatalf("round-trip parse failed for %+v: %v", tok, err)
		}
		if !reflect.DeepEqual(tok, tok2) {
			t.Fatalf("round-trip mismatch:\n got: %+v\nwant: %+v", tok2, tok)
		}
	})
}
