import { DataFrame } from '../../types/dataFrame';
import { DataTransformerInfo, TransformationApplicabilityLevels } from '../../types/transformations';

import { filterFieldsByNameTransformer } from './filterByName';
import { DataTransformerID } from './ids';
import { orderFieldsTransformer, OrderFieldsTransformerOptions } from './order';
import { renameFieldsTransformer, RenameFieldsTransformerOptions } from './rename';

export interface OrganizeFieldsTransformerOptions
  extends OrderFieldsTransformerOptions,
    RenameFieldsTransformerOptions {
  excludeByName: Record<string, boolean>;
  includeByName?: Record<string, boolean>;
}

export const organizeFieldsTransformer: DataTransformerInfo<OrganizeFieldsTransformerOptions> = {
  id: DataTransformerID.organize,
  name: 'Organize fields by name',
  description: 'Order, filter and rename fields based on configuration given by user',
  defaultOptions: {
    excludeByName: {},
    indexByName: {},
    renameByName: {},
    includeByName: {},
  },
  isApplicable: (data: DataFrame[]) => {
    return data.length > 1
      ? TransformationApplicabilityLevels.NotPossible
      : TransformationApplicabilityLevels.Applicable;
  },
  /**
   * Return a modified copy of the series. If the transform is not or should not
   * be applied, just return the input series
   */
  operator: (options, ctx) => (source) =>
    source.pipe(
      filterFieldsByNameTransformer.operator(
        {
          include: options.includeByName ? { names: mapToExcludeArray(options.includeByName) } : undefined,
          exclude: { names: mapToExcludeArray(options.excludeByName) },
        },
        ctx
      ),
      orderFieldsTransformer.operator(options, ctx),
      renameFieldsTransformer.operator(options, ctx)
    ),
};

const mapToExcludeArray = (excludeByName: Record<string, boolean>): string[] => {
  if (!excludeByName) {
    return [];
  }

  return Object.keys(excludeByName).filter((name) => excludeByName[name]);
};
