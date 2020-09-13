import { DataTransformerID } from './ids';
import { DataTransformerInfo } from '../../types/transformations';
import { OrderFieldsTransformerOptions, orderFieldsTransformer } from './order';
import { filterFieldsByNameTransformer } from './filterByName';
import { DataFrame } from '../..';
import { RenameFieldsTransformerOptions, renameFieldsTransformer } from './rename';

export interface OrganizeFieldsTransformerOptions
  extends OrderFieldsTransformerOptions,
    RenameFieldsTransformerOptions {
  excludeByName: Record<string, boolean>;
}

export const organizeFieldsTransformer: DataTransformerInfo<OrganizeFieldsTransformerOptions> = {
  id: DataTransformerID.organize,
  name: 'Organize fields by name',
  description: 'Order, filter and rename fields based on configuration given by user',
  defaultOptions: {
    excludeByName: {},
    indexByName: {},
    renameByName: {},
  },

  /**
   * Return a modified copy of the series.  If the transform is not or should not
   * be applied, just return the input series
   */
  transformer: (options: OrganizeFieldsTransformerOptions) => {
    const rename = renameFieldsTransformer.transformer(options);
    const order = orderFieldsTransformer.transformer(options);
    const filter = filterFieldsByNameTransformer.transformer({
      exclude: { names: mapToExcludeArray(options.excludeByName) },
    });

    return (data: DataFrame[]) => rename(order(filter(data)));
  },
};

const mapToExcludeArray = (excludeByName: Record<string, boolean>): string[] => {
  if (!excludeByName) {
    return [];
  }

  return Object.keys(excludeByName).filter(name => excludeByName[name]);
};
