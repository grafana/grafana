package msi_test

import (
	"testing"

	"github.com/grafana/grafana/pkg/build/daggerbuild/msi"
)

func TestVersion(t *testing.T) {
	tests := map[string]string{
		"1.2.3+security-01": "1.2.3.01",
		"1.2.3-beta1":       "1.2.3.1",
		"1.2.3":             "1.2.3.0",
	}

	for input, expect := range tests {
		res := msi.WxsVersion(input)
		if res != expect {
			t.Fatalf("for '%s' got '%s', expected '%s'", input, res, expect)
		}
	}
}
