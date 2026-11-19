import { isEqual } from 'lodash';

import { SceneDataTransformer, type SceneObject, SceneObjectBase, type VizPanel } from '@grafana/scenes';
import { sortedDeepCloneWithoutNulls } from 'app/core/utils/object';

import { AutoGridItem } from '../scene/layout-auto-grid/AutoGridItem';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { PanelTimeRange } from '../scene/panel-timerange/PanelTimeRange';
import { getQueryRunnerFor } from '../utils/getQueryRunnerFor';

type PanelEditArea = 'options' | 'field_config' | 'overrides' | 'queries' | 'transformations' | 'panel_info' | 'repeat';

export type PanelEditSnapshot = Partial<Record<PanelEditArea, unknown>>;

export type PanelEditChangedAreas = Record<PanelEditArea, boolean>;

/**
 * Captures the parts of a panel the panel editor can change, grouped by editor area.
 * Values are normalized so that a key set to undefined compares equal to a missing key.
 */
export function takePanelEditSnapshot(panel: VizPanel, layoutItem: SceneObject): PanelEditSnapshot {
  const queryRunner = getQueryRunnerFor(panel);
  const timeRange = panel.state.$timeRange;
  const data = panel.state.$data;

  return sortedDeepCloneWithoutNulls({
    options: panel.state.options,
    field_config: panel.state.fieldConfig?.defaults,
    overrides: panel.state.fieldConfig?.overrides,
    queries: {
      datasource: queryRunner?.state.datasource,
      queries: queryRunner?.state.queries,
      maxDataPoints: queryRunner?.state.maxDataPoints,
      minInterval: queryRunner?.state.minInterval,
      cacheTimeout: queryRunner?.state.cacheTimeout,
      queryCachingTTL: queryRunner?.state.queryCachingTTL,
      timeRange:
        timeRange instanceof PanelTimeRange
          ? {
              timeFrom: timeRange.state.timeFrom,
              timeShift: timeRange.state.timeShift,
              hideTimeOverride: timeRange.state.hideTimeOverride,
              compareWith: timeRange.state.compareWith,
            }
          : undefined,
    },
    transformations: data instanceof SceneDataTransformer ? data.state.transformations : undefined,
    panel_info: {
      title: panel.state.title,
      description: panel.state.description,
      subtitle: panel.state.subtitle,
      displayMode: panel.state.displayMode,
      links: getPanelLinks(panel),
    },
    repeat: getRepeatState(layoutItem),
  });
}

// Read here rather than through dashboardSceneGraph or VizPanelLinks: both import back into the panel editor.
function getPanelLinks(panel: VizPanel): unknown {
  const titleItems = Array.isArray(panel.state.titleItems) ? panel.state.titleItems : [];
  for (const item of titleItems) {
    if (item instanceof SceneObjectBase && 'rawLinks' in item.state) {
      return item.state.rawLinks;
    }
  }
  return undefined;
}

function getRepeatState(layoutItem: SceneObject) {
  if (layoutItem instanceof DashboardGridItem) {
    const { variableName, repeatDirection, maxPerRow } = layoutItem.state;
    return { variableName, repeatDirection, maxPerRow };
  }

  if (layoutItem instanceof AutoGridItem) {
    return { variableName: layoutItem.state.variableName };
  }

  return undefined;
}

export function diffPanelEditSnapshots(before: PanelEditSnapshot, after: PanelEditSnapshot): PanelEditChangedAreas {
  const changed = (area: PanelEditArea) => !isEqual(before[area], after[area]);

  return {
    options: changed('options'),
    field_config: changed('field_config'),
    overrides: changed('overrides'),
    queries: changed('queries'),
    transformations: changed('transformations'),
    panel_info: changed('panel_info'),
    repeat: changed('repeat'),
  };
}
