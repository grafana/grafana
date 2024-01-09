import { PanelBuilders } from '@grafana/scenes';
import { HeatmapColorMode } from 'app/plugins/panel/heatmap/types';

export function heatmapGraphBuilder() {
  return PanelBuilders.heatmap().setOption('calculate', false).setOption('color', {
    mode: HeatmapColorMode.Scheme,
    exponent: 0.5,
    scheme: 'Spectral',
    steps: 32,
    reverse: false,
  });
}
