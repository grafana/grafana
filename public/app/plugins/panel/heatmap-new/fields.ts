import { DataFrame, GrafanaTheme2 } from '@grafana/data';
import { PanelOptions } from './models.gen';

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

  return {
    warning: 'TODO... actualy create heatmap',
  };
}
