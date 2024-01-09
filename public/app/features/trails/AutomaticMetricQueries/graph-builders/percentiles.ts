import { PanelBuilders } from '@grafana/scenes';

export function percentilesGraphBuilder() {
  return PanelBuilders.timeseries().setCustomFieldConfig('fillOpacity', 9);
}
