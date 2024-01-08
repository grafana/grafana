import { PanelBuilders } from '@grafana/scenes';

import { AutoQueryDef } from '../types';

export function percentilesGraphBuilder(def: AutoQueryDef) {
  return PanelBuilders.timeseries().setTitle(def.title).setUnit(def.unit).setCustomFieldConfig('fillOpacity', 9);
}
