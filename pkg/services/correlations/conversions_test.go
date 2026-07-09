package correlations

import (
	"testing"

	"github.com/stretchr/testify/require"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"

	correlationsV0 "github.com/grafana/grafana/apps/correlations/pkg/apis/correlation/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func TestConversion(t *testing.T) {
	tests := []struct {
		name   string
		input  Correlation
		expect correlationsV0.Correlation
		create CreateCorrelationCommand
		update UpdateCorrelationCommand
	}{
		{
			name: "Basic fields",
			input: Correlation{
				UID:         "uid",
				OrgID:       2,
				Label:       "Test Label",
				Type:        query,
				SourceUID:   "source",
				SourceType:  new("source-type"),
				TargetUID:   new("target"),
				TargetType:  new("target-type"),
				Description: "A test correlation",
				Provisioned: true,
				Config: CorrelationConfig{
					Field: "test-field",
				},
			},
			expect: correlationsV0.Correlation{
				ObjectMeta: v1.ObjectMeta{
					Name:      "uid",
					UID:       types.UID("uid"),
					Namespace: "org-2",
					Annotations: map[string]string{
						"grafana.app/managedBy": "classic-file-provisioning",
					},
				},
				Spec: correlationsV0.CorrelationSpec{
					Description: new("A test correlation"),
					Label:       "Test Label",
					Type:        correlationsV0.CorrelationCorrelationTypeQuery,
					Source: correlationsV0.CorrelationDataSourceRef{
						Group: "source-type",
						Name:  "source",
					},
					Target: &correlationsV0.CorrelationDataSourceRef{
						Group: "target-type",
						Name:  "target",
					},
					Config: correlationsV0.CorrelationConfigSpec{
						Field: "test-field",
					},
				},
			},
			create: CreateCorrelationCommand{
				OrgId:       2,
				Label:       "Test Label",
				Type:        query,
				SourceUID:   "source",
				TargetUID:   new("target"),
				Description: "A test correlation",
				Provisioned: true,
				Config: CorrelationConfig{
					Field: "test-field",
				},
			},
			update: UpdateCorrelationCommand{
				UID:         "uid",
				OrgId:       2,
				Label:       new("Test Label"),
				Type:        new(query),
				SourceUID:   "source",
				Description: new("A test correlation"),
				Config: &CorrelationConfigUpdateDTO{
					Field:  new("test-field"),
					Target: &map[string]any{},
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			res, err := ToResource(tt.input)
			require.NoError(t, err)
			require.Equal(t, &tt.expect, res, "conversion")

			roundtrip, err := ToCorrelation(res)
			require.NoError(t, err)
			require.Equal(t, &tt.input, roundtrip, "roundtrip")

			create, err := ToCreateCorrelationCommand(res)
			require.NoError(t, err)
			require.Equal(t, &tt.create, create, "create")

			update, err := ToUpdateCorrelationCommand(res)
			require.NoError(t, err)
			require.Equal(t, &tt.update, update, "update")
		})
	}
}

// TestProvisionedCorrelationIsManaged locks in the behavior that a provisioned
// correlation is converted with the classic file-provisioning manager kind but no
// manager identity, and must still be reported as managed. Classic kinds are exempt
// from the "no identity => not managed" guard so this provisioning origin is not lost.
func TestProvisionedCorrelationIsManaged(t *testing.T) {
	res, err := ToResource(Correlation{
		UID:         "uid",
		OrgID:       2,
		Provisioned: true,
	})
	require.NoError(t, err)

	meta, err := utils.MetaAccessor(res)
	require.NoError(t, err)

	mgr, ok := meta.GetManagerProperties()
	require.True(t, ok, "provisioned correlation should be reported as managed")
	require.Equal(t, utils.ManagerKindClassicFP, mgr.Kind) //nolint:staticcheck
	require.Empty(t, mgr.Identity, "classic file-provisioning correlation has no manager identity")
}
