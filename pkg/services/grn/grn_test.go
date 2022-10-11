package grn

import (
	"fmt"
	"testing"
)

func TestParseGRNStr(t *testing.T) {
	tests := []struct {
		input     string
		expect    GRN
		expectErr bool
	}{
		{ // empty
			"",
			GRN{},
			true,
		},
		{ // too few parts
			"grn::dashboards",
			GRN{},
			true,
		},
		{ // too many parts
			"grn::dashboards:user:orgs:otherthings:hello:stillgoing",
			GRN{},
			true,
		},
		{ // Does not look like a GRN
			"hrn:grafana::123:dashboards/foo",
			GRN{},
			true,
		},
		{ // good!
			"grn::::roles/Admin",
			GRN{ResourceIdentifier: "roles/Admin"},
			false,
		},
	}

	for _, test := range tests {
		t.Run(fmt.Sprintf("ParseGRNStr(%q)", test.input), func(t *testing.T) {
			got, err := ParseGRNStr(test.input)
			if test.expectErr && err == nil {
				t.Fatal("wrong result. Expected error, got success")
			}

			if err != nil && !test.expectErr {
				t.Fatalf("wrong result. Expected success, got error %s", err.Error())
			}

			if got != test.expect {
				t.Fatalf("wrong result. Wanted %s, got %s\n", test.expect.String(), got.String())
			}
		})
	}
}
