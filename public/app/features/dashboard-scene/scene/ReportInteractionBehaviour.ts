import { reportInteraction } from '@grafana/runtime';

export function createReportInteractionBehavior() {
  const behavior = () => {};
  behavior.isAdHocFilterInteractionHandler = true;
  behavior.onFilterAdded = (p: { key: string; operator: string }) =>
    reportInteraction('grafana_unified_drilldown_filter_added', p);
  behavior.onFilterRemoved = (p: { key: string }) =>
    reportInteraction('grafana_unified_drilldown_filter_removed', p);
  behavior.onFilterMatchAll = (p: { key: string; origin?: string }) =>
    reportInteraction('grafana_unified_drilldown_filter_match_all', p);
  behavior.onFilterRestored = (p: { key: string; origin?: string }) =>
    reportInteraction('grafana_unified_drilldown_filter_restored', p);
  behavior.onGroupByAdded = (p: { key: string }) =>
    reportInteraction('grafana_unified_drilldown_groupby_added', p);
  behavior.onGroupByRemoved = (p: { key: string; origin?: string }) =>
    reportInteraction('grafana_unified_drilldown_groupby_removed', p);
  behavior.onGroupByRestored = () =>
    reportInteraction('grafana_unified_drilldown_groupby_restored');
  behavior.onClearAll = (p: { filtersCleared: number; originsRestored: number }) =>
    reportInteraction('grafana_unified_drilldown_clear_all', p);
  behavior.onRecentFilterApplied = (p: { key: string; operator: string }) =>
    reportInteraction('grafana_unified_drilldown_recent_filter_applied', p);
  behavior.onRecommendedFilterApplied = (p: { key: string; operator: string }) =>
    reportInteraction('grafana_unified_drilldown_recommended_filter_applied', p);
  behavior.onRecentGroupByApplied = (p: { key: string }) =>
    reportInteraction('grafana_unified_drilldown_recent_groupby_applied', p);
  behavior.onRecommendedGroupByApplied = (p: { key: string }) =>
    reportInteraction('grafana_unified_drilldown_recommended_groupby_applied', p);
  return behavior;
}
