import { PanelBuilders } from '@grafana/scenes';
import { SortOrder, TooltipDisplayMode } from '@grafana/schema/dist/esm/index';

import { HeatmapColorMode } from '../../../plugins/panel/heatmap/panelcfg.gen';

export type CommonVizParams = {
  title: string;
  unit: string;
};

export function simpleGraphBuilder({ title, unit }: CommonVizParams) {
  return PanelBuilders.timeseries() //
    .setTitle(title)
    .setUnit(unit)
    .setOption('legend', { showLegend: false })
    .setOption('tooltip', { mode: TooltipDisplayMode.Multi, sort: SortOrder.Descending })
    .setCustomFieldConfig('fillOpacity', 9);
}

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

export function percentilesGraphBuilder({ title, unit }: CommonVizParams) {
  return PanelBuilders.timeseries()
    .setTitle(title)
    .setUnit(unit)
    .setCustomFieldConfig('fillOpacity', 9)
    .setOption('tooltip', { mode: TooltipDisplayMode.Multi, sort: SortOrder.Descending })
    .setOption('legend', { showLegend: false });
}
