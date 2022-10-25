package grn_test

import (
	"encoding/json"
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/infra/grn"
	"github.com/stretchr/testify/require"
)

func TestParseGRNStr(t *testing.T) {
	tests := []struct {
		input     string
		expect    grn.GRN
		expectErr bool
	}{
		{ // empty
			"",
			grn.GRN{},
			true,
		},
		{ // too few parts
			"grn:dashboards",
			grn.GRN{},
			true,
		},
		{ // too many parts
			"grn::dashboards:user:orgs:otherthings:hello:stillgoing",
			grn.GRN{},
			true,
		},
		{ // Does not look like a GRN
			"hrn:grafana::123:dashboards/foo",
			grn.GRN{},
			true,
		},
		{ // Missing Kind
			"grn::foo",
			grn.GRN{},
			true,
		},
		{ // good!
			"grn::roles/Admin",
			grn.GRN{TenantID: 0, ResourceKind: "roles", ResourceIdentifier: "Admin"},
			false,
		},
		{ // good!
			"grn::roles/Admin/with/some/slashes",
			grn.GRN{TenantID: 0, ResourceKind: "roles", ResourceIdentifier: "Admin/with/some/slashes"},
			false,
		},
		{ // good!
			"grn:123456789:roles/Admin/with/some/slashes",
			grn.GRN{TenantID: 123456789, ResourceKind: "roles", ResourceIdentifier: "Admin/with/some/slashes"},
			false,
		},
		{ // Weird, but valid.
			"grn::roles///Admin/with/leading/slashes",
			grn.GRN{TenantID: 0, ResourceKind: "roles", ResourceIdentifier: "//Admin/with/leading/slashes"},
			false,
		},
	}

	for _, test := range tests {
		t.Run(fmt.Sprintf("ParseStr(%q)", test.input), func(t *testing.T) {
			got, err := grn.ParseStr(test.input)
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

func TestMarshalGRNs(t *testing.T) {
	simple := grn.GRN{TenantID: 123, ResourceKind: "A", ResourceIdentifier: "B"}
	require.Equal(t, simple, simple)
	require.Equal(t, simple, grn.GRN{TenantID: 123, ResourceIdentifier: "B", ResourceKind: "A"})

	type test struct {
		Hello grn.GRN `json:"hello"`
	}
	out, err := json.Marshal(test{Hello: simple})
	require.NoError(t, err)
	require.JSONEq(t, `{"hello":"grn:123:A/B"}`, string(out))

	copy := &test{}
	err = json.Unmarshal(out, copy)
	require.NoError(t, err)
	require.Equal(t, simple, copy.Hello)
}
