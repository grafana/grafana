import { PanelBuilders } from '@grafana/scenes';

import { CommonVizParams } from './types';

export function simpleGraphBuilder({ title, unit }: CommonVizParams) {
  return PanelBuilders.timeseries() //
    .setTitle(title)
    .setUnit(unit)
    .setOption('legend', { showLegend: false })
    .setCustomFieldConfig('fillOpacity', 9);
}
