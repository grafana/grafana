package conversion

import (
	"fmt"
	"strings"

	dashv2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2"
)

// ReportSummaryNotRepresentableError is returned when a v2 dashboard carries report section
// summaries that the target version has no field for. Failing the conversion makes readers fall
// back to the stored v2 resource instead of receiving, and possibly writing back, a copy
// without the authored text.
type ReportSummaryNotRepresentableError struct {
	TargetAPIVersion string
	RowTitles        []string
}

func (e *ReportSummaryNotRepresentableError) Error() string {
	return fmt.Sprintf(
		"dashboard has report section summaries (%s) that %s cannot represent; read and write it with %s",
		strings.Join(e.RowTitles, ", "), e.TargetAPIVersion, dashv2.APIVERSION,
	)
}

// checkReportSummariesRepresentable rejects a conversion from v2 that would silently drop authored
// report summaries. Header style and the paired column layout only affect presentation, so the
// existing projection may drop them.
func checkReportSummariesRepresentable(in *dashv2.Dashboard, targetAPIVersion string) error {
	titles := collectReportSummaryRowTitles(in.Spec.Layout.RowsLayoutKind, in.Spec.Layout.TabsLayoutKind, nil)
	if len(titles) == 0 {
		return nil
	}
	return &ReportSummaryNotRepresentableError{TargetAPIVersion: targetAPIVersion, RowTitles: titles}
}

func collectReportSummaryRowTitles(rows *dashv2.DashboardRowsLayoutKind, tabs *dashv2.DashboardTabsLayoutKind, titles []string) []string {
	if rows != nil {
		for _, row := range rows.Spec.Rows {
			if row.Spec.Summary != nil && strings.TrimSpace(*row.Spec.Summary) != "" {
				title := "untitled row"
				if row.Spec.Title != nil && *row.Spec.Title != "" {
					title = fmt.Sprintf("%q", *row.Spec.Title)
				}
				titles = append(titles, title)
			}
			titles = collectReportSummaryRowTitles(row.Spec.Layout.RowsLayoutKind, row.Spec.Layout.TabsLayoutKind, titles)
		}
	}
	if tabs != nil {
		for _, tab := range tabs.Spec.Tabs {
			titles = collectReportSummaryRowTitles(tab.Spec.Layout.RowsLayoutKind, tab.Spec.Layout.TabsLayoutKind, titles)
		}
	}
	return titles
}
