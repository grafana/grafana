import { PanelBuilders } from '@grafana/scenes';
import { SortOrder } from '@grafana/schema';
import { TooltipDisplayMode } from '@grafana/ui';

import { CommonVizParams } from './types';

export function percentilesGraphBuilder({ title, unit }: CommonVizParams) {
  return PanelBuilders.timeseries()
    .setTitle(title)
    .setUnit(unit)
    .setCustomFieldConfig('fillOpacity', 9)
    .setOption('tooltip', { mode: TooltipDisplayMode.Multi, sort: SortOrder.Descending })
    .setOption('legend', { showLegend: false });
}
