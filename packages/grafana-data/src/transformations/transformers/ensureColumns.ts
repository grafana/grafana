import { seriesToColumnsTransformer } from './seriesToColumns';
import { DataFrame } from '../../types/dataFrame';
import { getTimeField } from '../../dataframe/processDataFrame';
import { DataTransformerInfo } from '../../types/transformations';
import { DataTransformerID } from './ids';

export const ensureColumnsTransformer: DataTransformerInfo = {
  id: DataTransformerID.ensureColumns,
  name: 'Ensure Columns Transformer',
  description: 'Will check if current data frames is series or columns. If in series it will convert to columns.',
  transformer: () => (data: DataFrame[]) => {
    // Assume timeseries should first be joined by time
    const timeFieldName = findConsistentTimeFieldName(data);

    if (data.length > 1 && timeFieldName) {
      return seriesToColumnsTransformer.transformer({
        byField: timeFieldName,
      })(data);
    }

    return data;
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
