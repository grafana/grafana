package conversion

import (
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/utils/ptr"

	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	dashv2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2"
	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
)

func TestV1ToV2Editable(t *testing.T) {
	scheme := newTestScheme(t)
	for _, tc := range []struct {
		name     string
		editable *bool
		want     bool
	}{
		{name: "default", want: true},
		{name: "editable", editable: ptr.To(true), want: true},
		{name: "read only", editable: ptr.To(false)},
	} {
		t.Run(tc.name, func(t *testing.T) {
			spec := map[string]any{"title": "Classic", "schemaVersion": int64(41)}
			if tc.editable != nil {
				spec["editable"] = *tc.editable
			}
			in := &dashv1.Dashboard{Spec: dashv1.DashboardSpec{Object: spec}}
			out := &dashv2.Dashboard{}
			require.NoError(t, scheme.Convert(in, out, nil))
			require.Equal(t, ptr.To(tc.want), out.Spec.Editable)
		})
	}
}

func TestV1ToV2SeparatesQueryMetadataFromPluginOptions(t *testing.T) {
	scheme := newTestScheme(t)
	for _, tc := range []struct {
		name            string
		panelDatasource map[string]any
		wantUID         string
	}{
		{name: "uses target datasource", wantUID: "target-prom"},
		{
			name:            "uses the effective panel datasource",
			panelDatasource: map[string]any{"type": "prometheus", "uid": "panel-prom"},
			wantUID:         "panel-prom",
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			target := map[string]any{
				"refId": "B", "hide": true, "expr": "up",
				"datasource": map[string]any{"type": "prometheus", "uid": "target-prom"},
			}
			panel := map[string]any{
				"id": int64(1), "type": "timeseries", "title": "Panel",
				"gridPos": map[string]any{"x": 0, "y": 0, "w": 12, "h": 8},
				"targets": []any{target},
			}
			if tc.panelDatasource != nil {
				panel["datasource"] = tc.panelDatasource
			}
			in := &dashv1.Dashboard{Spec: dashv1.DashboardSpec{Object: map[string]any{
				"title": "Classic", "schemaVersion": int64(41), "panels": []any{panel},
			}}}
			out := &dashv2.Dashboard{}
			require.NoError(t, scheme.Convert(in, out, nil))
			element := out.Spec.Elements["panel-1"].PanelKind
			require.NotNil(t, element)
			queries := element.Spec.Data.Spec.Queries
			require.Len(t, queries, 1)
			query := queries[0].Spec
			require.Equal(t, "B", query.RefId)
			require.True(t, query.Hidden)
			require.Equal(t, "prometheus", query.Query.Group)
			require.NotNil(t, query.Query.Datasource)
			require.Equal(t, ptr.To(tc.wantUID), query.Query.Datasource.Name)
			// The scene serializer spreads plugin options over these query fields.
			require.Equal(t, "up", query.Query.Spec["expr"])
			for _, key := range []string{"hide", "refId", "datasource"} {
				require.NotContains(t, query.Query.Spec, key)
			}
		})
	}
}

func TestV2beta1TransformationRoundTrip(t *testing.T) {
	scheme := newTestScheme(t)
	transformation := dashv2beta1.DashboardTransformationKind{
		Kind: "reduce",
		Spec: dashv2beta1.DashboardDataTransformerConfig{
			Id: "reduce", RefId: ptr.To("reduced"), Disabled: ptr.To(true),
			Options: map[string]any{"reducers": []any{"max"}},
		},
	}
	in := validV2beta1Dashboard()
	panel := dashv2beta1.NewDashboardPanelKind()
	panel.Spec.Data.Spec.Transformations = []dashv2beta1.DashboardTransformationKind{transformation}
	in.Spec.Elements = map[string]dashv2beta1.DashboardElement{"panel-1": {PanelKind: panel}}

	stable := &dashv2.Dashboard{}
	require.NoError(t, scheme.Convert(in, stable, nil))
	stablePanel := stable.Spec.Elements["panel-1"].PanelKind
	require.NotNil(t, stablePanel)
	items := stablePanel.Spec.Data.Spec.Transformations
	require.Equal(t, []dashv2.DashboardTransformationKind{{
		Kind: "Transformation", Group: "reduce",
		Spec: dashv2.DashboardTransformationSpec{
			RefId: ptr.To("reduced"), Disabled: ptr.To(true), Options: map[string]any{"reducers": []any{"max"}},
		},
	}}, items)

	beta := &dashv2beta1.Dashboard{}
	require.NoError(t, scheme.Convert(stable, beta, nil))
	betaPanel := beta.Spec.Elements["panel-1"].PanelKind
	require.NotNil(t, betaPanel)
	require.Equal(t, []dashv2beta1.DashboardTransformationKind{transformation}, betaPanel.Spec.Data.Spec.Transformations)
}

func validV2alpha1Dashboard() *dashv2alpha1.Dashboard {
	return &dashv2alpha1.Dashboard{
		ObjectMeta: metav1.ObjectMeta{
			Namespace: "default",
			Name:      "test-dashboard",
		},
		Spec: dashv2alpha1.DashboardSpec{
			Title: "test dashboard",
			Layout: dashv2alpha1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{
				GridLayoutKind: &dashv2alpha1.DashboardGridLayoutKind{
					Kind: "GridLayout",
					Spec: dashv2alpha1.DashboardGridLayoutSpec{},
				},
			},
		},
	}
}

func validV2beta1Dashboard() *dashv2beta1.Dashboard {
	return &dashv2beta1.Dashboard{
		ObjectMeta: metav1.ObjectMeta{
			Namespace: "default",
			Name:      "test-dashboard",
		},
		Spec: dashv2beta1.DashboardSpec{
			Title: "test dashboard",
			Layout: dashv2beta1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{
				GridLayoutKind: &dashv2beta1.DashboardGridLayoutKind{
					Kind: "GridLayout",
					Spec: dashv2beta1.DashboardGridLayoutSpec{},
				},
			},
		},
	}
}

func TestV2ConversionSuccessStatus(t *testing.T) {
	scheme := newTestScheme(t)

	t.Run("v2alpha1 to v1beta1 sets success status", func(t *testing.T) {
		target := &dashv1.Dashboard{}
		err := scheme.Convert(validV2alpha1Dashboard(), target, nil)
		require.NoError(t, err)
		require.NotNil(t, target.Status.Conversion)
		require.False(t, target.Status.Conversion.Failed)
		require.NotNil(t, target.Status.Conversion.StoredVersion)
		require.Equal(t, dashv2alpha1.VERSION, *target.Status.Conversion.StoredVersion)
	})

	t.Run("v2alpha1 to v2beta1 sets success status", func(t *testing.T) {
		target := &dashv2beta1.Dashboard{}
		err := scheme.Convert(validV2alpha1Dashboard(), target, nil)
		require.NoError(t, err)
		require.NotNil(t, target.Status.Conversion)
		require.False(t, target.Status.Conversion.Failed)
		require.NotNil(t, target.Status.Conversion.StoredVersion)
		require.Equal(t, dashv2alpha1.VERSION, *target.Status.Conversion.StoredVersion)
	})

	t.Run("v2beta1 to v1beta1 sets success status", func(t *testing.T) {
		target := &dashv1.Dashboard{}
		err := scheme.Convert(validV2beta1Dashboard(), target, nil)
		require.NoError(t, err)
		require.NotNil(t, target.Status.Conversion)
		require.False(t, target.Status.Conversion.Failed)
		require.NotNil(t, target.Status.Conversion.StoredVersion)
		require.Equal(t, dashv2beta1.VERSION, *target.Status.Conversion.StoredVersion)
	})

	t.Run("v2beta1 to v2alpha1 sets success status", func(t *testing.T) {
		target := &dashv2alpha1.Dashboard{}
		err := scheme.Convert(validV2beta1Dashboard(), target, nil)
		require.NoError(t, err)
		require.NotNil(t, target.Status.Conversion)
		require.False(t, target.Status.Conversion.Failed)
		require.NotNil(t, target.Status.Conversion.StoredVersion)
		require.Equal(t, dashv2beta1.VERSION, *target.Status.Conversion.StoredVersion)
	})
}
