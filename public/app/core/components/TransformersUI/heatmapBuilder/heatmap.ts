import { DataFrame, DataTransformerID, SynchronousDataTransformerInfo } from '@grafana/data';
import { map } from 'rxjs';

export interface HeatmapOptions {
  keepOriginalValues?: boolean;
}

export const heatmapTransformer: SynchronousDataTransformerInfo<HeatmapOptions> = {
  id: DataTransformerID.heatmap,
  name: 'Create heatmap',
  description: 'calculate heatmap from source data',
  defaultOptions: {},

  operator: (options) => (source) => source.pipe(map((data) => heatmapTransformer.transformer(options)(data))),

  transformer: (options: HeatmapOptions) => {
    return (data: DataFrame[]) => {
      const heatmap = calculateHeatmapFromData(data, options);
      if (options.keepOriginalValues) {
        return [...data, heatmap];
      }
      return [heatmap];
    };
  },
};

export function calculateHeatmapFromData(data: DataFrame[], options: HeatmapOptions): DataFrame {
  // TODO!!!
  return data[0];
}
