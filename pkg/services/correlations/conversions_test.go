package correlations

import (
	"testing"

	"github.com/stretchr/testify/require"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/utils/ptr"

	authlib "github.com/grafana/authlib/types"
	correlationsV0 "github.com/grafana/grafana/apps/correlations/pkg/apis/correlation/v0alpha1"
)

func TestConversion(t *testing.T) {
	namespacer := authlib.OrgNamespaceFormatter

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
				SourceType:  ptr.To("source-type"),
				TargetUID:   ptr.To("target"),
				TargetType:  ptr.To("target-type"),
				Description: "A test correlation",
				Provisioned: true,
				Config: CorrelationConfig{
					Field: "test-field",
				},
			},
			expect: correlationsV0.Correlation{
				ObjectMeta: v1.ObjectMeta{
					Name:      "uid",
					Namespace: "org-2",
					Annotations: map[string]string{
						"grafana.app/managedBy": "classic-file-provisioning",
					},
				},
				Spec: correlationsV0.CorrelationSpec{
					Description: ptr.To("A test correlation"),
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
				TargetUID:   ptr.To("target"),
				Description: "A test correlation",
				Provisioned: true,
				Config: CorrelationConfig{
					Field: "test-field",
				},
			},
			update: UpdateCorrelationCommand{
				UID:         "uid",
				OrgId:       2,
				Label:       ptr.To("Test Label"),
				Type:        ptr.To(query),
				SourceUID:   "source",
				Description: ptr.To("A test correlation"),
				Config: &CorrelationConfigUpdateDTO{
					Field:  ptr.To("test-field"),
					Target: &map[string]any{},
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			res, err := ToResource(tt.input, namespacer)
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
