import { PanelBuilders } from '@grafana/scenes';
import { SortOrder } from '@grafana/schema';
import { TooltipDisplayMode } from '@grafana/ui';

import { CommonVizParams } from './types';

export function simpleGraphBuilder({ title, unit }: CommonVizParams) {
  return PanelBuilders.timeseries() //
    .setTitle(title)
    .setUnit(unit)
    .setOption('legend', { showLegend: false })
    .setOption('tooltip', { mode: TooltipDisplayMode.Multi, sort: SortOrder.Descending })
    .setCustomFieldConfig('fillOpacity', 9);
}
