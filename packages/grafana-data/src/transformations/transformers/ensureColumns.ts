import { map } from 'rxjs/operators';

import { getTimeField } from '../../dataframe/processDataFrame';
import { DataFrame } from '../../types/dataFrame';
import { SynchronousDataTransformerInfo } from '../../types/transformations';

import { DataTransformerID } from './ids';
import { joinByFieldTransformer } from './joinByField';

export const ensureColumnsTransformer: SynchronousDataTransformerInfo = {
  id: DataTransformerID.ensureColumns,
  name: 'Ensure Columns Transformer',
  description: 'Will check if current data frames is series or columns. If in series it will convert to columns.',

  operator: (options, ctx) => (source) =>
    source.pipe(map((data) => ensureColumnsTransformer.transformer(options, ctx)(data))),

  transformer: (_options: any, ctx) => (frames: DataFrame[]) => {
    // Assume timeseries should first be joined by time
    const timeFieldName = findConsistentTimeFieldName(frames);

    if (frames.length > 1 && timeFieldName) {
      return joinByFieldTransformer.transformer(
        {
          byField: timeFieldName,
        },
        ctx
      )(frames);
    }
    return frames;
  },
};

/**
 * Find the name for the time field used in all frames (if one exists)
 */
function findConsistentTimeFieldName(data: DataFrame[]): string | undefined {
  let name: string | undefined = undefined;
  for (const frame of data) {
    const { timeField } = getTimeField(frame);
    if (!timeField) {
      return undefined; // Not timeseries
    }
    if (!name) {
      name = timeField.name;
    } else if (name !== timeField.name) {
      // Second frame has a different time column?!
      return undefined;
    }
  }
  return name;
}
