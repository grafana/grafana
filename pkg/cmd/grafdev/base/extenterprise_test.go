package base

import "testing"

func TestExtGoIndicatesEnterpriseLinked(t *testing.T) {
	t.Parallel()
	cases := []struct {
		src string
		ok  bool
	}{
		{`package x
func init() { IsEnterprise = true }`, true},
		{`IsEnterprise	=	true`, true},
		{`var IsEnterprise = false`, false},
		{`package x`, false},
	}
	for _, tc := range cases {
		got := ExtGoIndicatesEnterpriseLinked([]byte(tc.src))
		if got != tc.ok {
			t.Fatalf("ExtGoIndicatesEnterpriseLinked(%q) = %v, want %v", tc.src, got, tc.ok)
		}
	}
}
