import { clone } from 'lodash';
import { map } from 'rxjs/operators';

import { cacheFieldDisplayNames, getFieldDisplayName } from '../../field/fieldState';
import { DataFrame, Field, FieldType } from '../../types/dataFrame';
import { DataTransformerInfo } from '../../types/transformations';

import { DataTransformerID } from './ids';

export enum OrderByMode {
  Manual = 'manual',
  Auto = 'auto',
}

export enum Order {
  Off = 'off',
  Asc = 'asc',
  Desc = 'desc',
}

export enum OrderByType {
  Name = 'name',
  Label = 'label',
}

export interface OrderByItem {
  type: OrderByType;
  name?: string;
  desc?: boolean;
}

export interface OrderFieldsTransformerOptions {
  indexByName?: Record<string, number>;
  orderByMode?: OrderByMode;
  orderBy?: OrderByItem[];
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
  operator:
    ({ indexByName, orderByMode = OrderByMode.Manual, orderBy = [] }) =>
    (source) =>
      source.pipe(
        map((data) => {
          cacheFieldDisplayNames(data);

          const orderer =
            orderByMode === OrderByMode.Manual
              ? createFieldsOrdererManual(indexByName!)
              : createFieldsOrdererAuto(orderBy);

          return data.map((frame) => ({
            ...frame,
            fields: orderer(frame.fields, data, frame),
          }));
        })
      ),
};

export const createOrderFieldsComparer = (indexByName: Record<string, number>) => (a: string, b: string) =>
  indexOfField(a, indexByName) - indexOfField(b, indexByName);

const createFieldsOrdererManual =
  (indexByName: Record<string, number>) => (fields: Field[], data: DataFrame[], frame: DataFrame) => {
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

const compare = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true }).compare;

/** @internal */
export const createFieldsOrdererAuto = (orderBy: OrderByItem[]) => (fields: Field[]) => {
  const firstTimeField = fields.find((f) => f.type === FieldType.time);
  return fields.slice().sort((fieldA, fieldB) => {
    if (fieldA === firstTimeField) {
      return -1;
    }
    if (fieldB === firstTimeField) {
      return 1;
    }
    for (let i = 0; i < orderBy.length; i++) {
      let { type, name = '', desc = false } = orderBy[i];

      let aVal = type === OrderByType.Name ? (fieldA.state?.displayName ?? fieldA.name) : (fieldA.labels?.[name] ?? '');
      let bVal = type === OrderByType.Name ? (fieldB.state?.displayName ?? fieldB.name) : (fieldB.labels?.[name] ?? '');

      let res = compare(aVal, bVal) * (desc ? -1 : 1);

      if (res !== 0) {
        return res;
      }
    }
    return 0;
  });
};
