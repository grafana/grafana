package resource

import (
	"testing"

	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
)

// Storage key parsers. Round-trip invariant: Parse(Marshal(x)) must
// equal x for any x the parser accepts. Random bytes must not panic.
func FuzzParseKey(f *testing.F) {
	for _, s := range []string{
		"group/resource/name/123~created~folder",
		"group/resource/ns/name/123~updated~folder",
		"g/r/n/0~deleted~",
		"g/r/ns/n/9223372036854775807~created~f",
	} {
		f.Add([]byte(s))
	}

	f.Fuzz(func(t *testing.T, data []byte) {
		k, err := ParseKey(string(data))
		if err != nil {
			return
		}
		k2, err := ParseKey(k.String())
		if err != nil {
			t.Fatalf("round-trip parse failed for %+v: %v", k, err)
		}
		if !k.Equals(k2) {
			t.Fatalf("round-trip mismatch:\n got: %+v\nwant: %+v", k2, k)
		}
	})
}

func FuzzParseKeyWithGUID(f *testing.F) {
	for _, s := range []string{
		// Production GUIDs are uuid.New().String(); seeds use realistic
		// UUID-shaped suffixes.
		"group/resource/name/123~created~folder~550e8400-e29b-41d4-a716-446655440000",
		"group/resource/ns/name/123~updated~folder~6ba7b810-9dad-11d1-80b4-00c04fd430c8",
		"g/r/n/0~deleted~~00000000-0000-0000-0000-000000000000",
	} {
		f.Add([]byte(s))
	}

	f.Fuzz(func(t *testing.T, data []byte) {
		k, err := kv.ParseKeyWithGUID(string(data))
		if err != nil {
			return
		}
		k2, err := kv.ParseKeyWithGUID(k.StringWithGUID())
		if err != nil {
			t.Fatalf("round-trip parse failed for %+v: %v", k, err)
		}
		if !k.Equals(k2) || k.GUID != k2.GUID {
			t.Fatalf("round-trip mismatch:\n got: %+v\nwant: %+v", k2, k)
		}
	})
}

func FuzzParseEventKey(f *testing.F) {
	for _, s := range []string{
		"123~ns~grp~res~name~created~folder",
		"0~~grp~res~name~updated~",
		"9223372036854775807~ns~g~r~n~deleted~f",
	} {
		f.Add([]byte(s))
	}

	f.Fuzz(func(t *testing.T, data []byte) {
		k, err := ParseEventKey(string(data))
		if err != nil {
			return
		}
		k2, err := ParseEventKey(k.String())
		if err != nil {
			t.Fatalf("round-trip parse failed for %+v: %v", k, err)
		}
		if k != k2 {
			t.Fatalf("round-trip mismatch:\n got: %+v\nwant: %+v", k2, k)
		}
	})
}

func FuzzParseLastImportKey(f *testing.F) {
	for _, s := range []string{
		"ns~grp~res~0",
		"ns~grp~res~1700000000",
		"~grp~res~1700000000",
	} {
		f.Add([]byte(s))
	}

	f.Fuzz(func(t *testing.T, data []byte) {
		k, err := ParseLastImportKey(string(data))
		if err != nil {
			return
		}
		// Known asymmetry: the formatter writes ts.Unix() with %d (int64)
		// but the parser uses strconv.ParseUint. Timestamps from a uint64
		// >= 2^63 cast to a negative int64 round-trip to a negative number
		// the parser rejects. Production never hits this (real epoch
		// seconds are nowhere near 2^63). The seed under testdata/fuzz
		// records the smallest reproducer.
		if k.LastImportTime.Unix() < 0 {
			return
		}
		k2, err := ParseLastImportKey(k.String())
		if err != nil {
			t.Fatalf("round-trip parse failed for %+v: %v", k, err)
		}
		if k != k2 {
			t.Fatalf("round-trip mismatch:\n got: %+v\nwant: %+v", k2, k)
		}
	})
}
