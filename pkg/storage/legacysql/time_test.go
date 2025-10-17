package legacysql

import (
	"fmt"
	"testing"
	"time"
)

func TestDBTime_ValueAndString_ZeroAndNonZero(t *testing.T) {
	zero := NewDBTime(time.Time{})
	if v, err := zero.Value(); err != nil {
		t.Fatalf("unexpected error for zero Value: %v", err)
	} else if v != nil {
		t.Fatalf("expected nil driver.Value for zero time, got %#v", v)
	}
	if s := zero.String(); s != "" {
		t.Fatalf("expected empty string for zero DBTime.String(), got %q", s)
	}

	tt := time.Date(2023, 10, 5, 13, 14, 15, 0, time.UTC)
	dt := NewDBTime(tt)

	val, err := dt.Value()
	if err != nil {
		t.Fatalf("unexpected error for non-zero Value: %v", err)
	}
	strVal, ok := val.(string)
	if !ok {
		t.Fatalf("expected Value to be string, got %T", val)
	}
	expected := tt.Format(time.DateTime)
	if strVal != expected {
		t.Fatalf("Value() = %q, want %q", strVal, expected)
	}

	if s := dt.String(); s != expected {
		t.Fatalf("String() = %q, want %q", s, expected)
	}
}

func TestDBTime_Scan_VariousInputs(t *testing.T) {
	base := time.Date(2022, 12, 31, 23, 59, 59, 0, time.UTC)
	layout := time.DateTime
	formatted := base.Format(layout)

	tests := []struct {
		name        string
		input       interface{}
		wantTime    time.Time
		wantIsZero  bool
		expectError bool
	}{
		{"nil sets zero", nil, time.Time{}, true, false},
		{"scan from string", formatted, base, false, false},
		{"scan from []byte", []byte(formatted), base, false, false},
		{"scan from time.Time", base, base, false, false},
		{"invalid parse", "not-a-time", time.Time{}, true, true},
		{"unsupported type", 12345, time.Time{}, true, true},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			var dt DBTime
			err := dt.Scan(tc.input)
			if tc.expectError {
				if err == nil {
					t.Fatalf("expected error, got nil")
				}
				// when expecting error, no further checks
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if tc.wantIsZero {
				if !dt.IsZero() {
					t.Fatalf("expected DBTime to be zero, got %v", dt.Time)
				}
				return
			}
			if dt.IsZero() {
				t.Fatalf("expected non-zero time, got zero")
			}
			// Compare times using Equal to ignore monotonic clock bits
			if !dt.Time.Equal(tc.wantTime) {
				t.Fatalf("scanned time = %v, want %v", dt.Time, tc.wantTime)
			}
		})
	}
}

func TestDBTime_Scan_ParseErrorDetails(t *testing.T) {
	var dt DBTime
	err := dt.Scan("garbage")
	if err == nil {
		t.Fatalf("expected parse error, got nil")
	}
	// error message should mention parse
	if !contains(err.Error(), "could not parse time") {
		t.Fatalf("unexpected error message: %v", err)
	}
}

func TestDBTime_Scan_UnsupportedTypeMessage(t *testing.T) {
	var dt DBTime
	typ := struct{}{}
	err := dt.Scan(typ)
	if err == nil {
		t.Fatalf("expected unsupported-type error, got nil")
	}
	want := fmt.Sprintf("could not scan type %T into DBTime", typ)
	if err.Error() != want {
		t.Fatalf("error = %q, want %q", err.Error(), want)
	}
}

// small helper to avoid importing strings for a single contains check
func contains(s, substr string) bool {
	return len(substr) == 0 || (len(s) >= len(substr) && indexOf(s, substr) >= 0)
}

func indexOf(s, substr string) int {
	n := len(s)
	m := len(substr)
	if m == 0 {
		return 0
	}
	for i := 0; i <= n-m; i++ {
		if s[i:i+m] == substr {
			return i
		}
	}
	return -1
}
