import { PanelBuilders } from '@grafana/scenes';
import { HeatmapColorMode } from 'app/plugins/panel/heatmap/types';

import { CommonVizParams } from './types';

export function heatmapGraphBuilder({ title, unit }: CommonVizParams) {
  return PanelBuilders.heatmap() //
    .setTitle(title)
    .setUnit(unit)
    .setOption('calculate', false)
    .setOption('color', {
      mode: HeatmapColorMode.Scheme,
      exponent: 0.5,
      scheme: 'Spectral',
      steps: 32,
      reverse: false,
    });
}
