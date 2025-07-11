import { map } from 'rxjs/operators';

import { getFieldDisplayName } from '../../field/fieldState';
import { DataFrame } from '../../types/dataFrame';
import { DataTransformerInfo } from '../../types/transformations';

import { DataTransformerID } from './ids';

/**
 * Options for fieldNameMappingTransformer
 *
 * @public
 */
export interface FieldNameMappingTransformerOptions {
  configRefId: string;
  from: string;
  to: string;
}

/**
 * Replaces the displayName of a field by applying a mapping from another query.
 *
 * @public
 */
export const fieldNameMappingTransformer: DataTransformerInfo<FieldNameMappingTransformerOptions> = {
  id: DataTransformerID.fieldNameMapping,
  name: 'Rename fields by mapping',
  description: 'Rename fields based on a mapping from another query.',
  defaultOptions: {
    configRefId: 'Mapping',
  },

  /**
   * Return a modified copy of the series. If the transform is not or should not
   * be applied, just return the input series
   */
  operator: (options) => (source) =>
    source.pipe(
      map((datasets) => {
        const mappingDataset = datasets.find((dataset) => dataset.refId === options.configRefId);

        const from = mappingDataset?.fields.find((e) => e.name === options.from)?.values ?? [];
        const to = mappingDataset?.fields.find((e) => e.name === options.to)?.values ?? [];

        const mapping = new Map();
        for (let i = 0; i < Math.min(from.length, to.length); ++i) {
          mapping.set(`${from[i]}`, `${to[i]}`);
        }

        return datasets.map((dataset) => applyMapping(dataset, mapping));
      })
    ),
};

function applyMapping(dataframe: DataFrame, map: Map<string, string>): DataFrame {
  return {
    ...dataframe,
    fields: dataframe.fields.map((field) => {
      const name = getFieldDisplayName(field, dataframe);
      const newName = map.get(name) ?? name;
      return {
        ...field,
        config: { ...field.config, displayName: newName },
        state: { ...field.state, displayName: newName },
      };
    }),
  };
}
