import { locationUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { sceneGraph, type VizPanel } from '@grafana/scenes';
import { type DataSourceRef } from '@grafana/schema';
import { contextSrv } from 'app/core/services/context_srv';
import { getExploreUrl } from 'app/core/utils/explore';

import { getDatasourceFromQueryRunner } from './getDatasourceFromQueryRunner';
import { getQueryRunnerFor } from './utils';

export function getEditPanelUrl(panelId: number) {
  return locationUtil.getUrlForPartial(locationService.getLocation(), { editPanel: panelId, viewPanel: undefined });
}

export function tryGetExploreUrlForPanel(vizPanel: VizPanel): Promise<string | undefined> {
  //const dashboard = panel.getRoot();
  const panelPlugin = vizPanel.getPlugin();
  const queryRunner = getQueryRunnerFor(vizPanel);

  if (!contextSrv.hasAccessToExplore() || panelPlugin?.meta.skipDataQuery || !queryRunner) {
    return Promise.resolve(undefined);
  }

  const timeRange = sceneGraph.getTimeRange(vizPanel);
  const datasource = getDatasourceFromQueryRunner(queryRunner);

  return getExploreUrl({
    queries: queryRunner.state.queries.map((query) => ({
      ...query,
      datasource: interpolateDatasourceRef(query.datasource, vizPanel),
    })),
    dsRef: interpolateDatasourceRef(datasource, vizPanel),
    timeRange: timeRange.state.value,
    scopedVars: { __sceneObject: { value: vizPanel } },
    adhocFilters: queryRunner.state.data?.request?.filters,
  });
}

// A datasource ref on a scene query runner may use a template variable as its uid (e.g.
// `$datasource`). Explore cannot resolve dashboard variables, so interpolate the ref against the
// panel's scene into a concrete datasource uid before building the Explore URL. Without this the
// unresolved variable ends up in the URL, and Explore falls back to the default datasource.
function interpolateDatasourceRef<T extends DataSourceRef | null | undefined>(ref: T, vizPanel: VizPanel): T {
  if (!ref?.uid) {
    return ref;
  }
  return { ...ref, uid: sceneGraph.interpolate(vizPanel, ref.uid) };
}
