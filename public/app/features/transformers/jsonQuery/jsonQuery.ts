import { JSONPath } from 'jsonpath-plus';
import { isString } from 'lodash';
import { map } from 'rxjs/operators';

import {
  DataFrame,
  DataTransformerID,
  SynchronousDataTransformerInfo,
  FieldType,
  Field,
  ArrayVector,
} from '@grafana/data';
import { findField } from 'app/features/dimensions/utils';

import { detectFieldType } from './detectFieldType';
import { JSONPathPlusReturn, JSONQueryOptions } from './types';

export const jsonQueryTransformer: SynchronousDataTransformerInfo<JSONQueryOptions> = {
  id: DataTransformerID.jsonQuery,
  name: 'JSON Query',
  description: 'Query JSON for specific values',
  defaultOptions: {},

  operator: (options: JSONQueryOptions) => (source) =>
    source.pipe(map((data: DataFrame[]) => jsonQueryTransformer.transformer(options)(data))),

  transformer: (options: JSONQueryOptions) => {
    return (data: DataFrame[]) => {
      return data.map((v) => queryJSON(v, options));
    };
  },
};

function queryJSON(frame: DataFrame, options: JSONQueryOptions): DataFrame {
  if (!options.source) {
    return frame;
  }

  const source = findField(frame, options.source);

  if (!source) {
    // this case can happen when there are multiple queries
    return frame;
  }

  const count = frame.length;
  const values = new Map<string, unknown>();

  for (let i = 0; i < count; i++) {
    let obj = source.values.get(i);
    if (isString(obj)) {
      try {
        obj = JSON.parse(obj);
      } catch {
        obj = {}; // empty
      }
    }

    const queryResultArray: JSONPathPlusReturn[] = JSONPath({
      path: options?.query ?? '$',
      json: obj,
      resultType: 'all',
    });

    queryResultArray.forEach((entry: JSONPathPlusReturn, index: number) => {
      const key = `${options?.alias ?? entry.parentProperty ?? 'Value'}_${i}_${index}`;
      values.set(key, [entry.value]);
    });
  }

  let fields: Field[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  values.forEach((value: any, key: string) => {
    fields.push({
      name: key,
      values: new ArrayVector(value),
      type: options.type && options.type !== FieldType.other ? options.type : detectFieldType(value),
      config: {},
    });
  });

  return {
    ...frame,
    fields,
  };
}
