package conversion

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	dashv2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2"
	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration"
	migrationtestutil "github.com/grafana/grafana/apps/dashboard/pkg/migration/testutil"
)

// A report row nested under a tab, so the check has to walk past the top-level layout.
const reportDashboardSpec = `{
  "title": "Rollout",
  "elements": {
    "rollout-progress": {"kind": "Panel", "spec": {"id": 1, "title": "Progress", "description": "", "links": [],
      "data": {"kind": "QueryGroup", "spec": {"queries": [], "transformations": [], "queryOptions": {}}},
      "vizConfig": {"kind": "VizConfig", "group": "timeseries", "version": "", "spec": {"options": {}, "fieldConfig": {"defaults": {}, "overrides": []}}}}}
  },
  "layout": {"kind": "TabsLayout", "spec": {"tabs": [{"kind": "TabsLayoutTab", "spec": {"title": "Wave 1",
    "layout": {"kind": "RowsLayout", "spec": {"rows": [{"kind": "RowsLayoutRow", "spec": {
      "title": "Rollout checkpoint",
      "headerStyle": "report",
      "summary": "Wave coverage does not establish readiness.",
      "layout": {"kind": "AutoGridLayout", "spec": {"columnWidthMode": "standard", "rowHeightMode": "standard",
        "columnLayout": "split-wide-first",
        "items": [{"kind": "AutoGridLayoutItem", "spec": {"element": {"kind": "ElementReference", "name": "rollout-progress"}}}]}}
    }}]}}
  }}]}},
  "annotations": [], "links": [], "variables": [], "tags": [], "cursorSync": "Off", "preload": false,
  "timeSettings": {"from": "now-6h", "to": "now", "autoRefresh": "", "autoRefreshIntervals": [], "fiscalYearStartMonth": 0, "hideTimepicker": false, "timezone": "browser", "weekStart": ""}
}`

func newReportTestScheme(t *testing.T) *runtime.Scheme {
	t.Helper()
	dsProvider := migrationtestutil.NewDataSourceProvider(migrationtestutil.StandardTestConfig)
	leProvider := migrationtestutil.NewTestLibraryElementProvider()
	migration.Initialize(dsProvider, leProvider, migration.DefaultCacheTTL)

	scheme := runtime.NewScheme()
	require.NoError(t, RegisterConversions(scheme, dsProvider, leProvider))
	return scheme
}

func newReportDashboard(t *testing.T, mutate func(spec map[string]any)) *dashv2.Dashboard {
	t.Helper()
	var raw map[string]any
	require.NoError(t, json.Unmarshal([]byte(reportDashboardSpec), &raw))
	if mutate != nil {
		mutate(raw)
	}
	specJSON, err := json.Marshal(raw)
	require.NoError(t, err)

	dash := &dashv2.Dashboard{
		TypeMeta:   metav1.TypeMeta{APIVersion: dashv2.APIVERSION, Kind: "Dashboard"},
		ObjectMeta: metav1.ObjectMeta{Name: "report", Namespace: "default"},
	}
	require.NoError(t, json.Unmarshal(specJSON, &dash.Spec))
	return dash
}

func reportRowSpec(spec map[string]any) map[string]any {
	tab := spec["layout"].(map[string]any)["spec"].(map[string]any)["tabs"].([]any)[0].(map[string]any)
	row := tab["spec"].(map[string]any)["layout"].(map[string]any)["spec"].(map[string]any)["rows"].([]any)[0].(map[string]any)
	return row["spec"].(map[string]any)
}

type conversionStatus struct {
	failed bool
	err    string
}

func statusOf(t *testing.T, obj runtime.Object) conversionStatus {
	t.Helper()
	read := func(failed bool, err *string) conversionStatus {
		s := conversionStatus{failed: failed}
		if err != nil {
			s.err = *err
		}
		return s
	}
	switch d := obj.(type) {
	case *dashv0.Dashboard:
		require.NotNil(t, d.Status.Conversion)
		return read(d.Status.Conversion.Failed, d.Status.Conversion.Error)
	case *dashv1.Dashboard:
		require.NotNil(t, d.Status.Conversion)
		return read(d.Status.Conversion.Failed, d.Status.Conversion.Error)
	case *dashv2alpha1.Dashboard:
		require.NotNil(t, d.Status.Conversion)
		return read(d.Status.Conversion.Failed, d.Status.Conversion.Error)
	case *dashv2beta1.Dashboard:
		require.NotNil(t, d.Status.Conversion)
		return read(d.Status.Conversion.Failed, d.Status.Conversion.Error)
	}
	t.Fatalf("unexpected type %T", obj)
	return conversionStatus{}
}

func olderDashboardTargets() map[string]func() runtime.Object {
	return map[string]func() runtime.Object{
		dashv0.APIVERSION:       func() runtime.Object { return &dashv0.Dashboard{} },
		dashv1.APIVERSION:       func() runtime.Object { return &dashv1.Dashboard{} },
		dashv2alpha1.APIVERSION: func() runtime.Object { return &dashv2alpha1.Dashboard{} },
		dashv2beta1.APIVERSION:  func() runtime.Object { return &dashv2beta1.Dashboard{} },
	}
}

func TestV2ReportSummaryIsNotSilentlyDropped(t *testing.T) {
	scheme := newReportTestScheme(t)

	for target, newOut := range olderDashboardTargets() {
		t.Run(target, func(t *testing.T) {
			out := newOut()
			require.NoError(t, scheme.Convert(newReportDashboard(t, nil), out, nil))

			status := statusOf(t, out)
			require.True(t, status.failed, "conversion must fail instead of dropping the summary")
			require.Contains(t, status.err, `"Rollout checkpoint"`)
			require.Contains(t, status.err, target)
		})
	}
}

func TestV2ReportPresentationOnlyStillConverts(t *testing.T) {
	scheme := newReportTestScheme(t)

	for target, newOut := range olderDashboardTargets() {
		t.Run(target, func(t *testing.T) {
			// Header style and split are presentation; without authored text the existing projection applies.
			in := newReportDashboard(t, func(spec map[string]any) {
				delete(reportRowSpec(spec), "summary")
			})
			out := newOut()
			require.NoError(t, scheme.Convert(in, out, nil))
			require.False(t, statusOf(t, out).failed)
		})
	}

	t.Run("whitespace-only summary is not authored text", func(t *testing.T) {
		in := newReportDashboard(t, func(spec map[string]any) {
			reportRowSpec(spec)["summary"] = "  \n "
		})
		out := &dashv1.Dashboard{}
		require.NoError(t, scheme.Convert(in, out, nil))
		require.False(t, statusOf(t, out).failed)
	})
}

func TestV2ReportFieldsRoundTripThroughV2Spec(t *testing.T) {
	in := newReportDashboard(t, nil)

	specJSON, err := json.Marshal(in.Spec)
	require.NoError(t, err)
	var decoded dashv2.DashboardSpec
	require.NoError(t, json.Unmarshal(specJSON, &decoded))

	row := decoded.Layout.TabsLayoutKind.Spec.Tabs[0].Spec.Layout.RowsLayoutKind.Spec.Rows[0].Spec
	require.NotNil(t, row.HeaderStyle)
	require.Equal(t, dashv2.DashboardRowsLayoutRowSpecHeaderStyleReport, *row.HeaderStyle)
	require.NotNil(t, row.Summary)
	require.Equal(t, "Wave coverage does not establish readiness.", *row.Summary)

	grid := row.Layout.AutoGridLayoutKind.Spec
	require.NotNil(t, grid.ColumnLayout)
	require.Equal(t, dashv2.DashboardAutoGridColumnLayoutSplitWideFirst, *grid.ColumnLayout)
}
