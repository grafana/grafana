import { DataFrame, GrafanaTheme2 } from '@grafana/data';
import { calculateHeatmapFromData } from 'app/core/components/TransformersUI/calculateHeatmap/heatmap';
import { HeatmapSourceMode, PanelOptions } from './models.gen';

export interface HeatmapData {
  // List of heatmap frames
  heatmap?: DataFrame;

  // Aligned version of any non-heatmap data.  This shares the same X axis as heatmap
  data?: DataFrame;

  // Errors
  warning?: string;
}

export function prepareHeatmapData(
  series: DataFrame[] | undefined,
  options: PanelOptions,
  theme: GrafanaTheme2
): HeatmapData {
  if (!series?.length) {
    return {};
  }

  const { source } = options;
  if (source === HeatmapSourceMode.Calculate) {
    const heatmap = calculateHeatmapFromData(series, options.heatmap ?? {});
    // TODO, check for error etc
    return { heatmap };
  } else if (source === HeatmapSourceMode.Data) {
    console.log('TODO find heatmap in the data');
  } else {
    // AUTO
    console.log('1. try to find it');
    console.log('1. calculate');
  }

  return {
    warning: 'TODO... actualy create heatmap',
  };
}
