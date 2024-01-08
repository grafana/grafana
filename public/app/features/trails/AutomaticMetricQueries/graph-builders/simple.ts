import { PanelBuilders } from '@grafana/scenes';

import { AutoQueryDef } from '../types';

export function simpleGraphBuilder(def: AutoQueryDef) {
  return PanelBuilders.timeseries()
    .setTitle(def.title)
    .setUnit(def.unit)
    .setOption('legend', { showLegend: false })
    .setCustomFieldConfig('fillOpacity', 9);
}
