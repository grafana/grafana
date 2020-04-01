import { cloneDeep } from 'lodash';
import { DataTransformerID } from './ids';
import { DataTransformerInfo } from '../../types/transformations';
import { DataFrame } from '../..';
import { Field } from '../../types';

export interface SortFieldsTransformerOptions {
  indexByName: Record<string, number>;
}

export const sortFieldsTransformer: DataTransformerInfo<SortFieldsTransformerOptions> = {
  id: DataTransformerID.sort,
  name: 'Sort fields by name',
  description: 'sort fields based on configuration given by user',
  defaultOptions: {
    indexByName: {},
  },

  /**
   * Return a modified copy of the series.  If the transform is not or should not
   * be applied, just return the input series
   */
  transformer: (options: SortFieldsTransformerOptions) => {
    const indexByName = cloneDeep(options.indexByName);
    const fieldsSorter = createFieldsSorter(indexByName);

    return (data: DataFrame[]) => {
      if (!Array.isArray(data) || data.length === 0) {
        return data;
      }

      return data.map(frame => {
        return {
          ...frame,
          fields: fieldsSorter(frame.fields),
        };
      });
    };
  },
};

const createFieldsSorter = (indexByName: Record<string, number>) => (fields: Field[]) => {
  if (!Array.isArray(fields) || fields.length === 0) {
    return fields;
  }

  return fields
    .reduce((sortedFields, field) => {
      sortedFields[getsertIndex(indexByName, field)] = field;
      return sortedFields;
    }, new Array<Field>(fields.length))
    .filter(field => !!field);
};

const getsertIndex = (indexByName: Record<string, number>, field: Field): number => {
  if (typeof indexByName[field.name] !== 'number') {
    indexByName[field.name] = Object.keys(indexByName).length;
  }
  return indexByName[field.name];
};
