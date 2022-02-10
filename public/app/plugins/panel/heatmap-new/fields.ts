import { DataFrame, DataFrameType, GrafanaTheme2 } from '@grafana/data';
import {
  calculateHeatmapFromData,
  createHeatmapFromBuckets,
} from 'app/core/components/TransformersUI/calculateHeatmap/heatmap';
import { HeatmapSourceMode, PanelOptions } from './models.gen';

export interface HeatmapData {
  // List of heatmap frames
  heatmap?: DataFrame;

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
    const heatmap = calculateHeatmapFromData(frames, options.heatmap ?? {});
    // TODO, check for error etc
    return { heatmap };
  }

  // Find a well defined heatmap
  let heatmap = frames.find((f) => f.meta?.type === DataFrameType.HeatmapScanLines);
  if (heatmap) {
    return { heatmap };
  }

  if (source === HeatmapSourceMode.Data) {
    // TODO: check for names xMin, yMin etc...
    heatmap = createHeatmapFromBuckets(frames);
    return { heatmap };
  }

  // detect a frame-per-bucket heatmap frame
  // TODO: improve heuristic?
  if (frames[0].meta?.custom?.resultType === 'matrix' && frames.some((f) => f.name?.endsWith('Inf'))) {
    let heatmap = createHeatmapFromBuckets(frames);
    return { heatmap };
  }

  heatmap = calculateHeatmapFromData(frames, options.heatmap ?? {});
  // TODO, check for error etc
  return { heatmap };
}
