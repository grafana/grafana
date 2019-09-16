import { DataTransformerID } from './ids';
import { DataFrame } from '../../types/dataFrame';
import { DataTransformerInfo } from '../../types/transformations';

export interface NoopTransformerOptions {
  include?: string;
  exclude?: string;
}

export const noopTransformer: DataTransformerInfo<NoopTransformerOptions> = {
  id: DataTransformerID.noop,
  name: 'noop',
  description: 'No-operation transformer',
  defaultOptions: {},

  /**
   * Return a modified copy of the series.  If the transform is not or should not
   * be applied, just return the input series
   */
  transformer: (options: NoopTransformerOptions) => {
    return (data: DataFrame[]) => data;
  },
};
