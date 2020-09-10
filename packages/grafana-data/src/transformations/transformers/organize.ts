import { mergeMap } from 'rxjs/operators';

import { DataTransformerID } from './ids';
import { DataTransformerInfo } from '../../types/transformations';
import { orderFieldsTransformer, OrderFieldsTransformerOptions } from './order';
import { filterFieldsByNameTransformer } from './filterByName';
import { renameFieldsTransformer, RenameFieldsTransformerOptions } from './rename';

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
  transformer: (options, data) => {
    return renameFieldsTransformer.transformer(options, data).pipe(
      mergeMap(rename =>
        orderFieldsTransformer.transformer(options, rename).pipe(
          mergeMap(order =>
            filterFieldsByNameTransformer.transformer(
              {
                exclude: { names: mapToExcludeArray(options.excludeByName) },
              },
              order
            )
          )
        )
      )
    );
  },
};

const mapToExcludeArray = (excludeByName: Record<string, boolean>): string[] => {
  if (!excludeByName) {
    return [];
  }

  return Object.keys(excludeByName).filter(name => excludeByName[name]);
};
