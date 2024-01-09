import { PanelBuilders } from '@grafana/scenes';

export function simpleGraphBuilder() {
  return PanelBuilders.timeseries().setOption('legend', { showLegend: false }).setCustomFieldConfig('fillOpacity', 9);
}
