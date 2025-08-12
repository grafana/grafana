import { locationUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { sceneGraph, VizPanel } from '@grafana/scenes';
import { contextSrv } from 'app/core/core';
import { getExploreUrl } from 'app/core/utils/explore';
import { InspectTab } from 'app/features/inspector/types';

import { getVizPanelPathId } from './pathId';
import { getQueryRunnerFor } from './utils';

export function getViewPanelUrl(vizPanel: VizPanel) {
  return locationUtil.getUrlForPartial(locationService.getLocation(), {
    viewPanel: getVizPanelPathId(vizPanel),
    editPanel: undefined,
  });
}

export function getEditPanelUrl(panelId: number) {
  return locationUtil.getUrlForPartial(locationService.getLocation(), { editPanel: panelId, viewPanel: undefined });
}

export function getInspectUrl(vizPanel: VizPanel, inspectTab?: InspectTab) {
  const inspect = vizPanel.state.key?.replace('-view', '');

  return locationUtil.getUrlForPartial(locationService.getLocation(), { inspect, inspectTab });
}

export function tryGetExploreUrlForPanel(vizPanel: VizPanel): Promise<string | undefined> {
  //const dashboard = panel.getRoot();
  const panelPlugin = vizPanel.getPlugin();
  const queryRunner = getQueryRunnerFor(vizPanel);

  if (!contextSrv.hasAccessToExplore() || panelPlugin?.meta.skipDataQuery || !queryRunner) {
    return Promise.resolve(undefined);
  }

  const timeRange = sceneGraph.getTimeRange(vizPanel);

  return getExploreUrl({
    queries: queryRunner.state.queries,
    dsRef: queryRunner.state.datasource,
    timeRange: timeRange.state.value,
    scopedVars: { __sceneObject: { value: vizPanel } },
    adhocFilters: queryRunner.state.data?.request?.filters,
  });
}
