package models

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func TestProvenanceToManagerProperties(t *testing.T) {
	tests := []struct {
		name string
		in   Provenance
		want utils.ManagerProperties
	}{
		{"file maps to classic file provisioning", ProvenanceFile, utils.ManagerProperties{Kind: utils.ManagerKindClassicFP}},                                                    //nolint:staticcheck
		{"api maps to classic api provisioning", ProvenanceAPI, utils.ManagerProperties{Kind: utils.ManagerKindClassicAPI}},                                                      //nolint:staticcheck
		{"converted_prometheus maps to classic converted prometheus", ProvenanceConvertedPrometheus, utils.ManagerProperties{Kind: utils.ManagerKindClassicConvertedPrometheus}}, //nolint:staticcheck
		{"none maps to unknown", ProvenanceNone, utils.ManagerProperties{}},
		{"unrecognized maps to unknown", Provenance("something-else"), utils.ManagerProperties{}},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, ProvenanceToManagerProperties(tc.in))
		})
	}
}

func TestManagerPropertiesToProvenance(t *testing.T) {
	// This mapping is intentionally lossy: the legacy provenance model cannot
	// distinguish specific managers (terraform/kubectl/repo) from the classic
	// shims, so several kinds collapse onto the same coarse provenance and the
	// Identity field is dropped. These assertions pin that intended loss so a
	// future change to the mapping is a deliberate, reviewed decision.
	tests := []struct {
		name string
		in   utils.ManagerProperties
		want Provenance
	}{
		{"classic api -> api", utils.ManagerProperties{Kind: utils.ManagerKindClassicAPI}, ProvenanceAPI},                                                                   //nolint:staticcheck
		{"classic file -> file", utils.ManagerProperties{Kind: utils.ManagerKindClassicFP}, ProvenanceFile},                                                                 //nolint:staticcheck
		{"classic converted prometheus -> converted_prometheus", utils.ManagerProperties{Kind: utils.ManagerKindClassicConvertedPrometheus}, ProvenanceConvertedPrometheus}, //nolint:staticcheck
		{"terraform collapses to api", utils.ManagerProperties{Kind: utils.ManagerKindTerraform, Identity: "workspace-x"}, ProvenanceAPI},
		{"kubectl collapses to api", utils.ManagerProperties{Kind: utils.ManagerKindKubectl, Identity: "ns/name"}, ProvenanceAPI},
		{"repo collapses to file", utils.ManagerProperties{Kind: utils.ManagerKindRepo, Identity: "my-repo"}, ProvenanceFile},
		{"unknown -> none", utils.ManagerProperties{}, ProvenanceNone},
		{"plugin -> none", utils.ManagerProperties{Kind: utils.ManagerKindPlugin}, ProvenanceNone},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, ManagerPropertiesToProvenance(tc.in))
		})
	}
}

func TestProvenanceMatchesManager(t *testing.T) {
	tests := []struct {
		name   string
		p      Provenance
		stored utils.ManagerProperties
		want   bool
	}{
		{
			name:   "coarse api matches stored terraform (its coarse form)",
			p:      ProvenanceAPI,
			stored: utils.ManagerProperties{Kind: utils.ManagerKindTerraform, Identity: "workspace-x"},
			want:   true,
		},
		{
			name:   "coarse api matches stored kubectl",
			p:      ProvenanceAPI,
			stored: utils.ManagerProperties{Kind: utils.ManagerKindKubectl, Identity: "ns/name"},
			want:   true,
		},
		{
			name:   "coarse file matches stored repo",
			p:      ProvenanceFile,
			stored: utils.ManagerProperties{Kind: utils.ManagerKindRepo, Identity: "my-repo"},
			want:   true,
		},
		{
			name:   "genuine provenance change does not match stored terraform",
			p:      ProvenanceFile,
			stored: utils.ManagerProperties{Kind: utils.ManagerKindTerraform, Identity: "workspace-x"},
			want:   false,
		},
		{
			name:   "unknown stored manager never matches",
			p:      ProvenanceAPI,
			stored: utils.ManagerProperties{},
			want:   false,
		},
		{
			name:   "classic stored matches its own coarse provenance",
			p:      ProvenanceAPI,
			stored: utils.ManagerProperties{Kind: utils.ManagerKindClassicAPI}, //nolint:staticcheck
			want:   true,
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, ProvenanceMatchesManager(tc.p, tc.stored))
		})
	}
}
