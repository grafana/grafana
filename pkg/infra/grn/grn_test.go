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
			"grn:dashboards",
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
		{ // Missing Kind
			"grn::foo",
			GRN{},
			true,
		},
		{ // good!
			"grn::roles/Admin",
			GRN{TenantID: 0, ResourceKind: "roles", ResourceIdentifier: "Admin"},
			false,
		},
		{ // good!
			"grn::roles/Admin/with/some/slashes",
			GRN{TenantID: 0, ResourceKind: "roles", ResourceIdentifier: "Admin/with/some/slashes"},
			false,
		},
		{ // good!
			"grn:123456789:roles/Admin/with/some/slashes",
			GRN{TenantID: 123456789, ResourceKind: "roles", ResourceIdentifier: "Admin/with/some/slashes"},
			false,
		},
		{ // Weird, but valid.
			"grn::roles///Admin/with/leading/slashes",
			GRN{TenantID: 0, ResourceKind: "roles", ResourceIdentifier: "//Admin/with/leading/slashes"},
			false,
		},
	}

	for _, test := range tests {
		t.Run(fmt.Sprintf("ParseStr(%q)", test.input), func(t *testing.T) {
			got, err := ParseStr(test.input)
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
