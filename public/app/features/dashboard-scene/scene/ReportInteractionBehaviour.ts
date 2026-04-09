import { reportInteraction } from '@grafana/runtime';
import { type AdHocFilterInteractionHandler } from '@grafana/scenes';

export function createReportInteractionBehavior(): AdHocFilterInteractionHandler {
  return {
    isAdHocFilterInteractionHandler: true,
    onFilterAdded: (p) => reportInteraction('grafana_unified_drilldown_filter_added', p),
    onFilterRemoved: (p) => reportInteraction('grafana_unified_drilldown_filter_removed', p),
    onFilterMatchAll: (p) => reportInteraction('grafana_unified_drilldown_filter_match_all', p),
    onFilterRestored: (p) => reportInteraction('grafana_unified_drilldown_filter_restored', p),
    onGroupByAdded: (p) => reportInteraction('grafana_unified_drilldown_groupby_added', p),
    onGroupByRemoved: (p) => reportInteraction('grafana_unified_drilldown_groupby_removed', p),
    onGroupByRestored: () => reportInteraction('grafana_unified_drilldown_groupby_restored'),
    onClearAll: (p) => reportInteraction('grafana_unified_drilldown_clear_all', p),
    onRecentFilterApplied: (p) => reportInteraction('grafana_unified_drilldown_recent_filter_applied', p),
    onRecommendedFilterApplied: (p) => reportInteraction('grafana_unified_drilldown_recommended_filter_applied', p),
    onRecentGroupByApplied: (p) => reportInteraction('grafana_unified_drilldown_recent_groupby_applied', p),
    onRecommendedGroupByApplied: (p) => reportInteraction('grafana_unified_drilldown_recommended_groupby_applied', p),
  };
}
