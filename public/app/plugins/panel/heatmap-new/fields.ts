import { DataFrame, DataFrameType, GrafanaTheme2 } from '@grafana/data';
import {
  calculateHeatmapFromData,
  createHeatmapFromBuckets,
} from 'app/core/components/TransformersUI/calculateHeatmap/heatmap';
import { HeatmapSourceMode, PanelOptions } from './models.gen';

export interface HeatmapData {
  // List of heatmap frames
  heatmap?: DataFrame;

  xBucketSize?: number;
  yBucketSize?: number;

  // Errors
  warning?: string;
}

export function prepareHeatmapData(
  frames: DataFrame[] | undefined,
  options: PanelOptions,
  theme: GrafanaTheme2
): HeatmapData {
  if (!frames?.length) {
    return {};
  }

  const { source } = options;
  if (source === HeatmapSourceMode.Calculate) {
    // TODO, check for error etc
    return getHeatmapData(calculateHeatmapFromData(frames, options.heatmap ?? {}));
  }

  // Find a well defined heatmap
  let heatmap = frames.find((f) => f.meta?.type === DataFrameType.HeatmapScanLines);
  if (heatmap) {
    return getHeatmapData(heatmap);
  }

  if (source === HeatmapSourceMode.Data) {
    // TODO: check for names xMin, yMin etc...
    return getHeatmapData(createHeatmapFromBuckets(frames));
  }

  // detect a frame-per-bucket heatmap frame
  // TODO: improve heuristic?
  if (frames[0].meta?.custom?.resultType === 'matrix' && frames.some((f) => f.name?.endsWith('Inf'))) {
    return getHeatmapData(createHeatmapFromBuckets(frames));
  }

  // TODO, check for error etc
  return getHeatmapData(calculateHeatmapFromData(frames, options.heatmap ?? {}));
}

const getHeatmapData = (data: DataFrame): HeatmapData => {
  if (data.fields.length < 2 || data.length < 2) {
    return { heatmap: data };
  }

  // Assuming dense heatmap (size is difference between first values)
  const xMin = data.fields[0].values;
  const yMin = data.fields[1].values;

  const xBucketSize = xMin.get(1) - xMin.get(0);
  const yBucketSize = yMin.get(1) - yMin.get(0);

  return { heatmap: data, xBucketSize, yBucketSize };
};
