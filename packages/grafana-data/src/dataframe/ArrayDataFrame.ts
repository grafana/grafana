import { QueryResultMeta } from '../types';
import { Field, FieldType, DataFrame, TIME_SERIES_VALUE_FIELD_NAME } from '../types/dataFrame';

import { guessFieldTypeForField } from './processDataFrame';

/**
 * The ArrayDataFrame takes an array of objects and presents it as a DataFrame
 *
 * @deprecated use arrayToDataFrame
 */
export class ArrayDataFrame<T = any> implements DataFrame {
  fields: Field[] = [];
  length = 0;
  name?: string;
  refId?: string;
  meta?: QueryResultMeta;

  constructor(source: T[], names?: string[]) {
    return arrayToDataFrame(source, names) as ArrayDataFrame<T>; // returns a standard DataFrame
  }
}

/**
 * arrayToDataFrame will convert any array into a DataFrame
 *
 * @public
 */
export function arrayToDataFrame(source: any[], names?: string[]): DataFrame {
  const df: DataFrame = {
    fields: [],
    length: source.length,
  };
  if (!source?.length) {
    return df;
  }

  if (names) {
    for (const name of names) {
      df.fields.push(
        makeFieldFromValues(
          name,
          source.map((v) => v[name])
        )
      );
    }
    return df;
  }

  const first = source.find((v) => v != null); // first not null|undefined
  if (first != null) {
    if (typeof first === 'object') {
      df.fields = Object.keys(first).map((name) => {
        return makeFieldFromValues(
          name,
          source.map((v) => v[name])
        );
      });
    } else {
      df.fields.push(makeFieldFromValues(TIME_SERIES_VALUE_FIELD_NAME, source));
    }
  }
  return df;
}

function makeFieldFromValues(name: string, values: unknown[]): Field {
  const f = { name, config: {}, values, type: FieldType.other };
  f.type = guessFieldTypeForField(f) ?? FieldType.other;
  return f;
}
