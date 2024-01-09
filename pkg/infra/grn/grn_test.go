package grn

import (
	"fmt"
	"testing"

	"github.com/google/go-cmp/cmp"
)

func TestParseGRNStr(t *testing.T) {
	tests := []struct {
		input     string
		expect    *GRN
		expectErr bool
	}{
		{ // empty
			"",
			&GRN{},
			true,
		},
		{ // too few parts
			"grn:dashboards",
			&GRN{},
			true,
		},
		{ // too many parts
			"grn::dashboards:user:orgs:otherthings:hello:stillgoing",
			&GRN{},
			true,
		},
		{ // Does not look like a GRN
			"hrn:grafana::123:dashboards/foo",
			&GRN{},
			true,
		},
		{ // Missing Kind
			"grn::foo",
			&GRN{},
			true,
		},
		{ // Missing Group
			"grn::foo/Bar",
			&GRN{},
			true,
		},
		{ // good!
			"grn::core.grafana.com/Role/Admin",
			&GRN{TenantID: 0, ResourceGroup: "core.grafana.com", ResourceKind: "Role", ResourceIdentifier: "Admin"},
			false,
		},
		{ // good!
			"grn::core.grafana.com/Role/Admin/with/some/slashes",
			&GRN{TenantID: 0, ResourceGroup: "core.grafana.com", ResourceKind: "Role", ResourceIdentifier: "Admin/with/some/slashes"},
			false,
		},
		{ // good!
			"grn:123456789:core.grafana.com/Role/Admin/with/some/slashes",
			&GRN{TenantID: 123456789, ResourceGroup: "core.grafana.com", ResourceKind: "Role", ResourceIdentifier: "Admin/with/some/slashes"},
			false,
		},
		{ // Weird, but valid.
			"grn::core.grafana.com/Role///Admin/with/leading/slashes",
			&GRN{TenantID: 0, ResourceGroup: "core.grafana.com", ResourceKind: "Role", ResourceIdentifier: "//Admin/with/leading/slashes"},
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

			if !cmp.Equal(test.expect, got) {
				t.Fatalf("wrong result. Wanted %s, got %s\n", test.expect.String(), got.String())
			}
		})
	}
}
