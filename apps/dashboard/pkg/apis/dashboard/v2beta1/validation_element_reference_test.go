package v2beta1

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/util/validation/field"
)

func gridItem(name string) DashboardGridLayoutItemKind {
	return DashboardGridLayoutItemKind{
		Kind: "GridLayoutItem",
		Spec: DashboardGridLayoutItemSpec{
			Element: DashboardElementReference{Kind: "ElementReference", Name: name},
		},
	}
}

func autoGridItem(name string) DashboardAutoGridLayoutItemKind {
	return DashboardAutoGridLayoutItemKind{
		Kind: "AutoGridLayoutItem",
		Spec: DashboardAutoGridLayoutItemSpec{
			Element: DashboardElementReference{Kind: "ElementReference", Name: name},
		},
	}
}

func gridLayout(names ...string) *DashboardGridLayoutKind {
	items := make([]DashboardGridLayoutItemKind, 0, len(names))
	for _, n := range names {
		items = append(items, gridItem(n))
	}
	return &DashboardGridLayoutKind{Kind: "GridLayout", Spec: DashboardGridLayoutSpec{Items: items}}
}

func tab(layout DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind) DashboardTabsLayoutTabKind {
	return DashboardTabsLayoutTabKind{Kind: "TabsLayoutTab", Spec: DashboardTabsLayoutTabSpec{Layout: layout}}
}

func row(layout DashboardGridLayoutKindOrAutoGridLayoutKindOrTabsLayoutKindOrRowsLayoutKind) DashboardRowsLayoutRowKind {
	return DashboardRowsLayoutRowKind{Kind: "RowsLayoutRow", Spec: DashboardRowsLayoutRowSpec{Layout: layout}}
}

func TestValidateUniqueElementReferences(t *testing.T) {
	tests := []struct {
		name         string
		layout       DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind
		expectedPath string
		firstPath    string
	}{
		{
			name: "distinct references across tabs, rows and grids",
			layout: DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{
				TabsLayoutKind: &DashboardTabsLayoutKind{Kind: "TabsLayout", Spec: DashboardTabsLayoutSpec{Tabs: []DashboardTabsLayoutTabKind{
					tab(DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{GridLayoutKind: gridLayout("panel-1", "panel-2")}),
					tab(DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{
						RowsLayoutKind: &DashboardRowsLayoutKind{Kind: "RowsLayout", Spec: DashboardRowsLayoutSpec{Rows: []DashboardRowsLayoutRowKind{
							row(DashboardGridLayoutKindOrAutoGridLayoutKindOrTabsLayoutKindOrRowsLayoutKind{GridLayoutKind: gridLayout("panel-3")}),
						}}},
					}),
				}}},
			},
		},
		{
			name: "duplicate inside one grid",
			layout: DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{
				GridLayoutKind: gridLayout("panel-1", "panel-2", "panel-1"),
			},
			expectedPath: "spec.layout.spec.items[2].spec.element.name",
			firstPath:    "spec.layout.spec.items[0].spec.element.name",
		},
		{
			name: "duplicate inside one auto grid",
			layout: DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{
				AutoGridLayoutKind: &DashboardAutoGridLayoutKind{Kind: "AutoGridLayout", Spec: DashboardAutoGridLayoutSpec{Items: []DashboardAutoGridLayoutItemKind{
					autoGridItem("panel-1"), autoGridItem("panel-1"),
				}}},
			},
			expectedPath: "spec.layout.spec.items[1].spec.element.name",
			firstPath:    "spec.layout.spec.items[0].spec.element.name",
		},
		{
			name: "duplicate across two tabs",
			layout: DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{
				TabsLayoutKind: &DashboardTabsLayoutKind{Kind: "TabsLayout", Spec: DashboardTabsLayoutSpec{Tabs: []DashboardTabsLayoutTabKind{
					tab(DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{GridLayoutKind: gridLayout("panel-1")}),
					tab(DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{GridLayoutKind: gridLayout("panel-1")}),
				}}},
			},
			expectedPath: "spec.layout.spec.tabs[1].spec.layout.spec.items[0].spec.element.name",
			firstPath:    "spec.layout.spec.tabs[0].spec.layout.spec.items[0].spec.element.name",
		},
		{
			name: "duplicate in rows nested inside tabs",
			layout: DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{
				TabsLayoutKind: &DashboardTabsLayoutKind{Kind: "TabsLayout", Spec: DashboardTabsLayoutSpec{Tabs: []DashboardTabsLayoutTabKind{
					tab(DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{
						RowsLayoutKind: &DashboardRowsLayoutKind{Kind: "RowsLayout", Spec: DashboardRowsLayoutSpec{Rows: []DashboardRowsLayoutRowKind{
							row(DashboardGridLayoutKindOrAutoGridLayoutKindOrTabsLayoutKindOrRowsLayoutKind{GridLayoutKind: gridLayout("panel-1")}),
							row(DashboardGridLayoutKindOrAutoGridLayoutKindOrTabsLayoutKindOrRowsLayoutKind{GridLayoutKind: gridLayout("panel-2", "panel-1")}),
						}}},
					}),
				}}},
			},
			expectedPath: "spec.layout.spec.tabs[0].spec.layout.spec.rows[1].spec.layout.spec.items[1].spec.element.name",
			firstPath:    "spec.layout.spec.tabs[0].spec.layout.spec.rows[0].spec.layout.spec.items[0].spec.element.name",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			errs := validateUniqueElementReferences(tt.layout)
			if tt.expectedPath == "" {
				assert.Empty(t, errs)
				return
			}
			require.Len(t, errs, 1)
			assert.Equal(t, field.ErrorTypeDuplicate, errs[0].Type)
			assert.Equal(t, tt.expectedPath, errs[0].Field)
			assert.Equal(t, "panel-1", errs[0].BadValue)
			assert.Contains(t, errs[0].Detail, tt.firstPath)
		})
	}
}

func TestValidateDashboardSpecRejectsDuplicateElementReferences(t *testing.T) {
	newDashboard := func(secondTabElement string) *Dashboard {
		spec := NewDashboardSpec()
		spec.Title = "Duplicate references"
		spec.Layout = DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{
			TabsLayoutKind: &DashboardTabsLayoutKind{Kind: "TabsLayout", Spec: DashboardTabsLayoutSpec{Tabs: []DashboardTabsLayoutTabKind{
				tab(DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{GridLayoutKind: gridLayout("panel-1")}),
				tab(DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{GridLayoutKind: gridLayout(secondTabElement)}),
			}}},
		}
		return &Dashboard{Spec: *spec}
	}

	assert.Empty(t, ValidateDashboardSpec(newDashboard("panel-2")))

	errs := ValidateDashboardSpec(newDashboard("panel-1"))
	require.Len(t, errs, 1)
	assert.Equal(t, field.ErrorTypeDuplicate, errs[0].Type)
	assert.Equal(t, "spec.layout.spec.tabs[1].spec.layout.spec.items[0].spec.element.name", errs[0].Field)
}
