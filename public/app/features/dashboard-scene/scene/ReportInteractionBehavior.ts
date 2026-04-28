import { reportInteraction } from '@grafana/runtime';
import {
  SceneObjectBase,
  type AdHocFilterInteractionHandler,
  type SceneObjectState,
} from '@grafana/scenes';

export class ReportInteractionBehavior
  extends SceneObjectBase<SceneObjectState>
  implements AdHocFilterInteractionHandler
{
  public readonly isAdHocFilterInteractionHandler = true as const;

  public constructor() {
    super({});
  }

  public onFilterAdded(p: { key: string; operator: string }) {
    reportInteraction('grafana_unified_drilldown_filter_added', p);
  }

  public onFilterRemoved(p: { key: string }) {
    reportInteraction('grafana_unified_drilldown_filter_removed', p);
  }

  public onFilterMatchAll(p: { key: string; origin?: string }) {
    reportInteraction('grafana_unified_drilldown_filter_match_all', p);
  }

  public onFilterRestored(p: { key: string; origin?: string }) {
    reportInteraction('grafana_unified_drilldown_filter_restored', p);
  }

  public onGroupByAdded(p: { key: string }) {
    reportInteraction('grafana_unified_drilldown_groupby_added', p);
  }

  public onGroupByRemoved(p: { key: string; origin?: string }) {
    reportInteraction('grafana_unified_drilldown_groupby_removed', p);
  }

  public onGroupByRestored() {
    reportInteraction('grafana_unified_drilldown_groupby_restored');
  }

  public onClearAll(p: { filtersCleared: number; originsRestored: number }) {
    reportInteraction('grafana_unified_drilldown_clear_all', p);
  }

  public onRecentFilterApplied(p: { key: string; operator: string }) {
    reportInteraction('grafana_unified_drilldown_recent_filter_applied', p);
  }

  public onRecommendedFilterApplied(p: { key: string; operator: string }) {
    reportInteraction('grafana_unified_drilldown_recommended_filter_applied', p);
  }

  public onRecentGroupByApplied(p: { key: string }) {
    reportInteraction('grafana_unified_drilldown_recent_groupby_applied', p);
  }

  public onRecommendedGroupByApplied(p: { key: string }) {
    reportInteraction('grafana_unified_drilldown_recommended_groupby_applied', p);
  }
}
