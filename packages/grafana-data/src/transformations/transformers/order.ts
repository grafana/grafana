import { clone } from 'lodash';
import { map } from 'rxjs/operators';

import { getFieldDisplayName } from '../../field/fieldState';
import { DataFrame, Field } from '../../types';
import { DataTransformerInfo } from '../../types/transformations';

import { DataTransformerID } from './ids';

export interface OrderFieldsTransformerOptions {
  indexByName: Record<string, number>;
}

export const orderFieldsTransformer: DataTransformerInfo<OrderFieldsTransformerOptions> = {
  id: DataTransformerID.order,
  name: 'Order fields by name',
  description: 'Order fields based on configuration given by user',
  defaultOptions: {
    indexByName: {},
  },

  /**
   * Return a modified copy of the series. If the transform is not or should not
   * be applied, just return the input series
   */
  operator: (options) => (source) =>
    source.pipe(
      map((data) => {
        const orderer = createFieldsOrderer(options.indexByName);

        if (!Array.isArray(data) || data.length === 0) {
          return data;
        }

        return data.map((frame) => ({
          ...frame,
          fields: orderer(frame.fields, data, frame),
        }));
      })
    ),
};

export const createOrderFieldsComparer = (indexByName: Record<string, number>) => (a: string, b: string) => {
  return indexOfField(a, indexByName) - indexOfField(b, indexByName);
};

const createFieldsOrderer =
  (indexByName: Record<string, number>) => (fields: Field[], data: DataFrame[], frame: DataFrame) => {
    if (!Array.isArray(fields) || fields.length === 0) {
      return fields;
    }
    if (!indexByName || Object.keys(indexByName).length === 0) {
      return fields;
    }
    const comparer = createOrderFieldsComparer(indexByName);
    return clone(fields).sort((a, b) =>
      comparer(getFieldDisplayName(a, frame, data), getFieldDisplayName(b, frame, data))
    );
  };

const indexOfField = (fieldName: string, indexByName: Record<string, number>) => {
  if (Number.isInteger(indexByName[fieldName])) {
    return indexByName[fieldName];
  }
  return Number.MAX_SAFE_INTEGER;
};
