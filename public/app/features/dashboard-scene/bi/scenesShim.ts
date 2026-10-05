import { type AdHocFilterWithLabels, type SceneObject } from '@grafana/scenes';

/**
 * Local copy of the Scenes `DataRequestFiltersEnricher` interface.
 *
 * Grafana compiles against @grafana/scenes 8.19.0, which does not have it yet. It is added by the Scenes PR
 * "feat(SceneQueryRunner): let the scene root adjust ad hoc filters per request" (grafana/scenes branch
 * `sj/adhoc-filter-source-panel-exclusion`). Remove this file and import the interface from @grafana/scenes
 * once that release is pinned here.
 */
export interface DataRequestFiltersEnricher {
  // Called with the ad hoc filters a SceneQueryRunner (source) is about to send. Return the filters to send instead.
  enrichDataRequestFilters(source: SceneObject, filters: AdHocFilterWithLabels[]): AdHocFilterWithLabels[];
}
