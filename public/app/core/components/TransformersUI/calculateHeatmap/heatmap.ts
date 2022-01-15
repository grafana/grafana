import { DataFrame, DataTransformerID, SynchronousDataTransformerInfo } from '@grafana/data';
import { map } from 'rxjs';
import { HeatmapCalculationOptions } from './types';

export interface HeatmapTransformerOptions extends HeatmapCalculationOptions {
  /** the raw values will still exist in results after transformation */
  keepOriginalData?: boolean;

  /** create a new histogram for each input frame */
  independantCalcs?: boolean;
}

export const heatmapTransformer: SynchronousDataTransformerInfo<HeatmapTransformerOptions> = {
  id: DataTransformerID.heatmap,
  name: 'Create heatmap',
  description: 'calculate heatmap from source data',
  defaultOptions: {},

  operator: (options) => (source) => source.pipe(map((data) => heatmapTransformer.transformer(options)(data))),

  transformer: (options: HeatmapTransformerOptions) => {
    return (data: DataFrame[]) => {
      const results: DataFrame[] = options.keepOriginalData ? data.slice() : [];
      if (options.independantCalcs) {
        for (const input of data) {
          results.push(calculateHeatmapFromData([input], options));
        }
      } else {
        results.push(calculateHeatmapFromData(data, options));
      }
      return results;
    };
  },
};

export function calculateHeatmapFromData(data: DataFrame[], options: HeatmapCalculationOptions): DataFrame {
  // TODO!!!
  return data[0];
}
