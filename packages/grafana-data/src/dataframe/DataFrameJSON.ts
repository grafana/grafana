import { DataFrame, FieldType, FieldConfig, Labels, QueryResultMeta } from '../types';
import { ArrayVector } from '../vector';
import { guessFieldTypeFromNameAndValue } from './processDataFrame';

/**
 * The JSON transfer object for DataFrames.  Values are stored in simple JSON
 *
 * @alpha
 */
export interface DataFrameJSON {
  schema?: DataFrameSchema;

  data?: any[][];

  replaced?: FieldValueReplacements[];
}

/**
 * The JSON transfer object for DataFrames.  Values are stored in simple JSON
 *
 * @alpha
 */
export interface DataFrameSchema {
  /**
   * Matches the query target refId
   */
  refId?: string;

  /**
   * Initial response global metadata
   */
  meta?: QueryResultMeta;

  /**
   * Frame name
   */
  name?: string;

  /**
   * Field definition without any metadata
   */
  fields?: FieldSchema[];
}

/**
 * Field object passed over JSON
 *
 * @alpha
 */
export interface FieldSchema {
  name: string; // The column name
  type?: FieldType;
  config?: FieldConfig;
  labels?: Labels;
}

/**
 * Since JSON does not support encoding some numeric types, we need to replace them on load.
 * While some system solve this by encoding everythign as strings, this approach lets is
 * efficiently communicate which values needed special encoding.
 *
 * @alpha
 */
export interface FieldValueReplacements {
  NaN?: number[];
  Undef?: number[]; // Missing because of absense or join
  Inf?: number[];
  NegInf?: number[];
}

const replacements: Record<keyof FieldValueReplacements, any> = {
  Inf: Infinity,
  NegInf: -Infinity,
  Undef: undefined,
  NaN: NaN,
};

export function applyFieldValueReplacements(replaced: FieldValueReplacements, col: any[]) {
  if (!replaced || !col) {
    return;
  }
  for (const key in replaced) {
    const val = replacements[key as keyof FieldValueReplacements];
    for (const idx of replaced[key as keyof FieldValueReplacements]!) {
      col[idx] = val;
    }
  }
}

function guessFieldType(name: string, values: any[]): FieldType {
  for (const v of values) {
    if (v != null) {
      return guessFieldTypeFromNameAndValue(name, v);
    }
  }
  return FieldType.other;
}

/**
 * NOTE: data in the original array will be replaced with values from the DataFrameReplacements property
 *
 * @alpha
 */
export function dataFrameFromJSON(dto: DataFrameJSON): DataFrame {
  const { schema, replaced, data } = dto;
  if (!schema || !schema.fields) {
    throw new Error('JSON needs a fields definition');
  }

  // Find the longest field length
  let length = 0;
  if (data) {
    for (const f of data) {
      let flen = f.length;
      if (flen && flen > length) {
        length = flen;
      }
    }
  }

  const fields = schema.fields.map((f, index) => {
    let r: FieldValueReplacements = {};
    let buffer = data ? data[index] : [];
    buffer.length = length; // will pad with undefined
    if (data && replaced && replaced[index]) {
      r = replaced[index];
      applyFieldValueReplacements(r, buffer);
    }
    return {
      ...f,
      replaced: r,
      type: f.type ?? guessFieldType(f.name, buffer),
      config: f.config ?? {},
      values: new ArrayVector(buffer),
    };
  });
  return {
    ...schema,
    fields,
    length: fields[0].values.length,
  };
}
