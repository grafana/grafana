import { PanelBuilders } from '@grafana/scenes';

import { CommonVizParams } from './types';

export function percentilesGraphBuilder({ title, unit }: CommonVizParams) {
  return PanelBuilders.timeseries() //
    .setTitle(title)
    .setUnit(unit)
    .setCustomFieldConfig('fillOpacity', 9);
}
