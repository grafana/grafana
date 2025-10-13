import { QueryResultMeta } from '../types/data';
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
    return arrayToDataFrame(source, names); // returns a standard DataFrame
  }
}

/**
 * arrayToDataFrame will convert any array into a DataFrame.
 * @param source - can be an array of objects or an array of simple values.
 * @param names - will be used for ordering of fields. Source needs to be array of objects if names are provided.
 *
 * @public
 */
export function arrayToDataFrame(source: Array<Record<string, unknown>> | unknown[], names?: string[]): DataFrame {
  const df: DataFrame = {
    fields: [],
    length: source.length,
  };
  if (!source?.length) {
    return df;
  }

  // If names are provided then we assume the source is an array of objects with the names as keys (field names). This
  // makes ordering of the fields predictable.
  if (names) {
    if (!isObjectArray(source)) {
      throw new Error('source is not an array of objects');
    }

    for (const name of names) {
      df.fields.push(
        makeFieldFromValues(
          name,
          source.map((v) => (v ? v[name] : v))
        )
      );
    }
    return df;
  }

  const firstDefined = source.find((v) => v); // first not null|undefined
  // This means if the source is lots of null/undefined values we throw that away and return empty dataFrame. This is
  // different to how we preserve null/undefined values if there is some defined rows. Not sure this inconsistency
  // is by design or not.
  if (firstDefined === null) {
    return df;
  }

  // If is an array of objects we use the keys as field names.
  if (isObjectArray(source)) {
    // We need to do this to please TS. We know source is array of objects and that there is some object in there but
    // TS still thinks it can all be undefined|nulls.
    const first = source.find((v) => v);
    df.fields = Object.keys(first || {}).map((name) => {
      return makeFieldFromValues(
        name,
        source.map((v) => (v ? v[name] : v))
      );
    });
  } else {
    // Otherwise source should be an array of simple values, so we create single field data frame.
    df.fields.push(makeFieldFromValues(TIME_SERIES_VALUE_FIELD_NAME, source));
  }
  return df;
}

function makeFieldFromValues(name: string, values: unknown[]): Field {
  const f = { name, config: {}, values, type: FieldType.other };
  f.type = guessFieldTypeForField(f) ?? FieldType.other;
  return f;
}

function isObjectArray(arr: unknown[]): arr is Array<Record<string, unknown> | null | undefined> {
  const first = arr.find((v) => v); // first not null|undefined
  return arr.length > 0 && typeof first === 'object';
}
