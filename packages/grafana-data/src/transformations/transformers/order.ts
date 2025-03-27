import { clone } from 'lodash';
import { map } from 'rxjs/operators';

import { getFieldDisplayName } from '../../field/fieldState';
import { DataFrame, Field } from '../../types/dataFrame';
import { DataTransformerInfo } from '../../types/transformations';

import { DataTransformerID } from './ids';

export enum FieldOrdering {
  Manual = 'manual',
  Auto = 'auto',
}

export enum Order {
  Off = 'off',
  Asc = 'asc',
  Desc = 'desc',
}

export interface LabelSort {
  labelName: string;
  order: Order;
  index: number;
}

export interface OrderFieldsTransformerOptions {
  indexByName?: Record<string, number>;
  fieldOrder: FieldOrdering;
  fieldNameSort?: { order: Order; index: number };
  labelSort?: LabelSort[];
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
        if (options.fieldOrder === FieldOrdering.Manual) {
          const orderer = createFieldsOrdererManual(options.indexByName!);

          if (!Array.isArray(data) || data.length === 0) {
            return data;
          }

          return data.map((frame) => ({
            ...frame,
            fields: orderer(frame.fields, data, frame),
          }));
        } else {
          const orderer = createFieldsOrdererAuto(options.fieldNameSort, options.labelSort);

          return data.map((frame) => ({
            ...frame,
            fields: orderer(frame.fields, data, frame),
          }));
        }
      })
    ),
};

export const createOrderFieldsComparer = (indexByName: Record<string, number>) => (a: string, b: string) => {
  return indexOfField(a, indexByName) - indexOfField(b, indexByName);
};

const createFieldsOrdererManual =
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

const createFieldsOrdererAuto =
  (fieldNameSort?: { order: Order; index: number }, labelSort?: LabelSort[]) =>
  (fields: Field[], data: DataFrame[], frame: DataFrame) => {
    let allSort: Array<{ labelName?: string; order: Order; index: number }> = [...(labelSort ?? [])];
    if (fieldNameSort !== undefined) {
      allSort.push(fieldNameSort);
    }

    allSort = allSort.filter((s) => s.order !== Order.Off).sort((a, b) => a.index - b.index);
    if (!Array.isArray(fields) || fields.length === 0) {
      return fields;
    }
    if (!allSort || allSort.length === 0) {
      return fields;
    }

    return clone(fields).sort((fieldA, fieldB) => {
      let compareReturn = 0;
      for (let i = 0; i < allSort.length; i++) {
        let compareValA =
          allSort[i].labelName === undefined
            ? fieldA.name
            : fieldA.labels
              ? fieldA.labels[allSort[i].labelName!]
              : undefined;
        let compareValB =
          allSort[i].labelName === undefined
            ? fieldB.name
            : fieldB.labels
              ? fieldB.labels[allSort[i].labelName!]
              : undefined;

        if (compareValA === compareValB) {
          continue;
        } else if (compareValA === undefined) {
          compareReturn = -1;
          break;
        } else if (compareValB === undefined) {
          compareReturn = 1;
          break;
        } else {
          // field name sort
          compareReturn =
            allSort[i].order === Order.Asc ? (compareValA > compareValB ? 1 : -1) : compareValA < compareValB ? 1 : -1;
        }
      }
      return compareReturn;
    });
  };
