import { DataTransformerID } from './ids';
import { DataTransformerInfo } from '../../types/transformations';
import { OrderFieldsTransformerOptions, OrderFieldsTransformer } from './order';
import { filterFieldsByNameTransformer } from './filterByName';
import { DataFrame } from '../..';

export interface OrganizeFieldsTransformerOptions extends OrderFieldsTransformerOptions {
  excludeByName: Record<string, boolean>;
}

export const OrganizeFieldsTransformer: DataTransformerInfo<OrganizeFieldsTransformerOptions> = {
  id: DataTransformerID.organize,
  name: 'Organize fields by name',
  description: 'Order, filter and rename fields based on configuration given by user',
  defaultOptions: {
    excludeByName: {},
    indexByName: {},
  },

  /**
   * Return a modified copy of the series.  If the transform is not or should not
   * be applied, just return the input series
   */
  transformer: (options: OrganizeFieldsTransformerOptions) => {
    const order = OrderFieldsTransformer.transformer(options);
    const filter = filterFieldsByNameTransformer.transformer({
      exclude: mapToExcludeRegexp(options.excludeByName),
    });

    return (data: DataFrame[]) => order(filter(data));
  },
};

const mapToExcludeRegexp = (excludeByName: Record<string, boolean>): string | undefined => {
  if (!excludeByName) {
    return undefined;
  }

  const fieldsToExclude = Object.keys(excludeByName)
    .filter(name => excludeByName[name])
    .join('|');

  if (fieldsToExclude.length === 0) {
    return undefined;
  }

  return `^(${fieldsToExclude})$`;
};
