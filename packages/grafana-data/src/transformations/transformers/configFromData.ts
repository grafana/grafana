import { DataTransformerID } from './ids';
import { DataTransformerInfo } from '../../types/transformations';
import { map } from 'rxjs/operators';
import { DataFrame } from '../../types';

export interface ConfigFromDataTransformerOptions {}

export const configFromDataTransformer: DataTransformerInfo<ConfigFromDataTransformerOptions> = {
  id: DataTransformerID.configFromData,
  name: 'Config from data',
  description: 'Set unit, min, max and more from data',
  defaultOptions: {},

  /**
   * Return a modified copy of the series.  If the transform is not or should not
   * be applied, just return the input series
   */
  operator: (options) => (source) => source.pipe(map((data) => extractConfigFromData(options, data))),
};

export function extractConfigFromData(options: ConfigFromDataTransformerOptions, data: DataFrame[]) {
  return data;
}
