package conversion

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"

	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	dashv2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/testutil"
)

func TestSectionAnnotationsRoundTripV2V2beta1(t *testing.T) {
	scheme := newSectionAnnotationScheme(t)
	source := dashboardWithSectionAnnotations()

	var v2beta1 dashv2beta1.Dashboard
	require.NoError(t, scheme.Convert(source, &v2beta1, nil))
	assert.Equal(t, []string{"row-deploys", "tab-a", "nested-row", "tab-b"}, sectionAnnotationNamesV2beta1(v2beta1.Spec.Layout))

	var roundTrip dashv2.Dashboard
	require.NoError(t, scheme.Convert(&v2beta1, &roundTrip, nil))
	assert.Equal(t, []string{"row-deploys", "tab-a", "nested-row", "tab-b"}, sectionAnnotationNamesV2(roundTrip.Spec.Layout))
}

func TestSectionAnnotationsV2ToV1ReportsDataLoss(t *testing.T) {
	scheme := newSectionAnnotationScheme(t)
	source := dashboardWithSectionAnnotations()

	var v1 dashv1.Dashboard
	require.NoError(t, scheme.Convert(source, &v1, nil))

	// Conversion records data loss through checkConversionDataLoss. v1 has nowhere
	// to store a row or tab annotation, so the count drops.
	err := checkConversionDataLoss(dashv2.APIVERSION, dashv1.APIVERSION, source, &v1)
	require.Error(t, err)

	var dataLossErr *ConversionDataLossError
	require.ErrorAs(t, err, &dataLossErr)
	assert.Contains(t, err.Error(), "annotation count decreased")
}

func newSectionAnnotationScheme(t *testing.T) *runtime.Scheme {
	t.Helper()
	dsProvider := testutil.NewDataSourceProvider(testutil.StandardTestConfig)
	leProvider := testutil.NewLibraryElementProvider()
	migration.Initialize(dsProvider, leProvider, migration.DefaultCacheTTL)

	scheme := runtime.NewScheme()
	require.NoError(t, RegisterConversions(scheme, dsProvider, leProvider))
	return scheme
}

func dashboardWithSectionAnnotations() *dashv2.Dashboard {
	nestedRow := dashv2.DashboardRowsLayoutRowKind{
		Kind: "RowsLayoutRow",
		Spec: dashv2.DashboardRowsLayoutRowSpec{
			Layout: dashv2.DashboardGridLayoutKindOrAutoGridLayoutKindOrTabsLayoutKindOrRowsLayoutKind{
				GridLayoutKind: dashv2.NewDashboardGridLayoutKind(),
			},
			Annotations: []dashv2.DashboardAnnotationQueryKind{sectionAnnotationV2("nested-row")},
		},
	}
	tabA := dashv2.DashboardTabsLayoutTabKind{
		Kind: "TabsLayoutTab",
		Spec: dashv2.DashboardTabsLayoutTabSpec{
			Layout: dashv2.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{
				RowsLayoutKind: &dashv2.DashboardRowsLayoutKind{
					Kind: "RowsLayout",
					Spec: dashv2.DashboardRowsLayoutSpec{Rows: []dashv2.DashboardRowsLayoutRowKind{nestedRow}},
				},
			},
			Annotations: []dashv2.DashboardAnnotationQueryKind{sectionAnnotationV2("tab-a")},
		},
	}
	tabB := dashv2.DashboardTabsLayoutTabKind{
		Kind: "TabsLayoutTab",
		Spec: dashv2.DashboardTabsLayoutTabSpec{
			Layout: dashv2.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{
				GridLayoutKind: dashv2.NewDashboardGridLayoutKind(),
			},
			Annotations: []dashv2.DashboardAnnotationQueryKind{sectionAnnotationV2("tab-b")},
		},
	}
	outerRow := dashv2.DashboardRowsLayoutRowKind{
		Kind: "RowsLayoutRow",
		Spec: dashv2.DashboardRowsLayoutRowSpec{
			Layout: dashv2.DashboardGridLayoutKindOrAutoGridLayoutKindOrTabsLayoutKindOrRowsLayoutKind{
				TabsLayoutKind: &dashv2.DashboardTabsLayoutKind{
					Kind: "TabsLayout",
					Spec: dashv2.DashboardTabsLayoutSpec{
						Tabs: []dashv2.DashboardTabsLayoutTabKind{tabA, tabB},
					},
				},
			},
			Annotations: []dashv2.DashboardAnnotationQueryKind{sectionAnnotationV2("row-deploys")},
		},
	}

	spec := dashv2.NewDashboardSpec()
	spec.Title = "Section annotations"
	spec.Layout = dashv2.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{
		RowsLayoutKind: &dashv2.DashboardRowsLayoutKind{
			Kind: "RowsLayout",
			Spec: dashv2.DashboardRowsLayoutSpec{Rows: []dashv2.DashboardRowsLayoutRowKind{outerRow}},
		},
	}

	return &dashv2.Dashboard{Spec: *spec}
}

func sectionAnnotationV2(name string) dashv2.DashboardAnnotationQueryKind {
	return dashv2.DashboardAnnotationQueryKind{
		Kind: "AnnotationQuery",
		Spec: dashv2.DashboardAnnotationQuerySpec{
			Name:   name,
			Enable: true,
			Query: dashv2.DashboardDataQueryKind{
				Kind:    "DataQuery",
				Version: "v0",
				Group:   "grafana",
				Spec:    map[string]any{},
			},
		},
	}
}

func sectionAnnotationNamesV2(layout dashv2.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind) []string {
	var names []string
	if layout.RowsLayoutKind != nil {
		names = append(names, rowAnnotationNamesV2(layout.RowsLayoutKind)...)
	}
	if layout.TabsLayoutKind != nil {
		names = append(names, tabAnnotationNamesV2(layout.TabsLayoutKind)...)
	}
	return names
}

func rowAnnotationNamesV2(rows *dashv2.DashboardRowsLayoutKind) []string {
	var names []string
	for _, row := range rows.Spec.Rows {
		for _, annotation := range row.Spec.Annotations {
			names = append(names, annotation.Spec.Name)
		}
		if row.Spec.Layout.RowsLayoutKind != nil {
			names = append(names, rowAnnotationNamesV2(row.Spec.Layout.RowsLayoutKind)...)
		}
		if row.Spec.Layout.TabsLayoutKind != nil {
			names = append(names, tabAnnotationNamesV2(row.Spec.Layout.TabsLayoutKind)...)
		}
	}
	return names
}

func tabAnnotationNamesV2(tabs *dashv2.DashboardTabsLayoutKind) []string {
	var names []string
	for _, tab := range tabs.Spec.Tabs {
		for _, annotation := range tab.Spec.Annotations {
			names = append(names, annotation.Spec.Name)
		}
		names = append(names, sectionAnnotationNamesV2(tab.Spec.Layout)...)
	}
	return names
}

func sectionAnnotationNamesV2beta1(layout dashv2beta1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind) []string {
	var names []string
	if layout.RowsLayoutKind != nil {
		names = append(names, rowAnnotationNamesV2beta1(layout.RowsLayoutKind)...)
	}
	if layout.TabsLayoutKind != nil {
		names = append(names, tabAnnotationNamesV2beta1(layout.TabsLayoutKind)...)
	}
	return names
}

func rowAnnotationNamesV2beta1(rows *dashv2beta1.DashboardRowsLayoutKind) []string {
	var names []string
	for _, row := range rows.Spec.Rows {
		for _, annotation := range row.Spec.Annotations {
			names = append(names, annotation.Spec.Name)
		}
		if row.Spec.Layout.RowsLayoutKind != nil {
			names = append(names, rowAnnotationNamesV2beta1(row.Spec.Layout.RowsLayoutKind)...)
		}
		if row.Spec.Layout.TabsLayoutKind != nil {
			names = append(names, tabAnnotationNamesV2beta1(row.Spec.Layout.TabsLayoutKind)...)
		}
	}
	return names
}

func tabAnnotationNamesV2beta1(tabs *dashv2beta1.DashboardTabsLayoutKind) []string {
	var names []string
	for _, tab := range tabs.Spec.Tabs {
		for _, annotation := range tab.Spec.Annotations {
			names = append(names, annotation.Spec.Name)
		}
		names = append(names, sectionAnnotationNamesV2beta1(tab.Spec.Layout)...)
	}
	return names
}
