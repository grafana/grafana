package lease

import (
	"testing"
)

// In package lease (not lease_test) so we can fuzz unexported
// parseLeaseKey. Round-trip: Parse(Marshal(x)) must equal x.
func FuzzParseLeaseKey(f *testing.F) {
	for _, s := range []string{
		"a" + generationSeparator + "00000000000000000001",
		"some-lease-name" + generationSeparator + "00000000000000000042",
		generationSeparator + "00000000000000000000",
		"name-with~tilde" + generationSeparator + "00000000000000000099",
	} {
		f.Add([]byte(s))
	}

	f.Fuzz(func(t *testing.T, data []byte) {
		k, err := parseLeaseKey(string(data))
		if err != nil {
			return
		}
		k2, err := parseLeaseKey(k.String())
		if err != nil {
			t.Fatalf("round-trip parse failed for %+v: %v", k, err)
		}
		if k != k2 {
			t.Fatalf("round-trip mismatch:\n got: %+v\nwant: %+v", k2, k)
		}
	})
}
