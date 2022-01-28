import { DataFrame, GrafanaTheme2 } from '@grafana/data';
import {
  calculateHeatmapFromData,
  createHeatmapFromBuckets,
} from 'app/core/components/TransformersUI/calculateHeatmap/heatmap';
import { HeatmapSourceMode, PanelOptions } from './models.gen';
//import { DataSourceType } from 'app/features/alerting/unified/utils/datasource';

export interface HeatmapData {
  // List of heatmap frames
  heatmap?: DataFrame;

  // Aligned version of any non-heatmap data.  This shares the same X axis as heatmap
  data?: DataFrame;

  // Errors
  warning?: string;
}

export function prepareHeatmapData(
  frames: DataFrame[] | undefined,
  options: PanelOptions,
  theme: GrafanaTheme2
): HeatmapData {
  // let dataSrcType = data.request?.targets[0].datasource?.type;

  // if (dataSrcType === DataSourceType.Prometheus) {
  //   console.log(data.series);
  // } else if (dataSrcType === 'testdata') {
  //   console.log(data.series);
  // }

  if (!frames?.length) {
    return {};
  }

  // detect a frame-per-bucket heatmap frame
  // TODO: improve heuristic?
  if (frames[0].meta?.custom?.resultType === 'matrix' && frames.some((f) => f.name?.endsWith('Inf'))) {
    let heatmap = createHeatmapFromBuckets(frames);
    return { heatmap };
  }

  const { source } = options;
  if (source === HeatmapSourceMode.Calculate) {
    const heatmap = calculateHeatmapFromData(frames, options.heatmap ?? {});
    // TODO, check for error etc
    return { heatmap };
  } else if (source === HeatmapSourceMode.Data) {
    console.log('TODO find heatmap in the data');
  } else {
    // AUTO
    //console.log('1. try to find it');
    //console.log('1. calculate');
  }

  const heatmap = calculateHeatmapFromData(frames, options.heatmap ?? {});
  // TODO, check for error etc
  return { heatmap };
}
