package conversion

import (
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
)

func TestNormalizeLegacyDashboardUID(t *testing.T) {
	tests := []struct {
		name         string
		expectedName string
	}{
		{
			name:         "short-valid-dashboard",
			expectedName: "short-valid-dashboard",
		},
		{
			name:         "this-is-a-long-dashboard-name-for-sure-even-if-not-said-so",
			expectedName: "e3dff1e11cc1643ac0e7e771b7ed556904f4313a",
		},
		{
			name:         "dashboard.with.dots",
			expectedName: "679a065b3fb5c7d9d4c476e62f8818286467c8b4",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dashboard := &dashv1.Dashboard{ObjectMeta: metav1.ObjectMeta{Name: tt.name}}
			normalizeLegacyDashboardUID(dashboard)
			require.Equal(t, tt.expectedName, dashboard.Name)
			require.LessOrEqual(t, len(dashboard.Name), 40)
		})
	}
}

func TestConvertV2alpha1ToV1NormalizesLegacyUID(t *testing.T) {
	const longName = "this-is-a-long-dashboard-name-for-sure-even-if-not-said-so"

	in := &dashv2alpha1.Dashboard{
		ObjectMeta: metav1.ObjectMeta{
			Namespace: "default",
			Name:      longName,
		},
		Spec: dashv2alpha1.DashboardSpec{
			Title: "Test dashboard",
			Layout: dashv2alpha1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{
				GridLayoutKind: &dashv2alpha1.DashboardGridLayoutKind{
					Kind: "GridLayout",
					Spec: dashv2alpha1.DashboardGridLayoutSpec{},
				},
			},
		},
	}
	out := &dashv1.Dashboard{}

	require.NoError(t, Convert_V2alpha1_to_V1(in, out, nil))
	require.Equal(t, "e3dff1e11cc1643ac0e7e771b7ed556904f4313a", out.Name)
}
