import { DataFrame, FieldType, FieldConfig, Labels, QueryResultMeta, Field } from '../types';

import { guessFieldTypeFromNameAndValue } from './processDataFrame';

/**
 * The JSON transfer object for DataFrames.  Values are stored in simple JSON
 *
 * @alpha
 */
export interface DataFrameJSON {
  /**
   * The schema defines the field type and configuration.
   */
  schema?: DataFrameSchema;

  /**
   * The field data
   */
  data?: DataFrameData;
}

type FieldValues = unknown[];

/**
 * @alpha
 */
export interface DataFrameData {
  /**
   * A columnar store that matches fields defined by schema.
   */
  values: FieldValues[];

  /**
   * Since JSON cannot encode NaN, Inf, -Inf, and undefined, these entities
   * are decoded after JSON.parse() using this struct
   */
  entities?: Array<FieldValueEntityLookup | null>;

  /**
   * Holds value bases per field so we can encode numbers from fixed points
   * e.g. [1612900958, 1612900959, 1612900960] -> 1612900958 + [0, 1, 2]
   */
  bases?: number[];

  /**
   * Holds value multipliers per field so we can encode large numbers concisely
   * e.g. [4900000000, 35000000000] -> 1e9 + [4.9, 35]
   */
  factors?: number[];

  /**
   * Holds enums per field so we can encode recurring string values as ints
   * e.g. ["foo", "foo", "baz", "foo"] -> ["foo", "baz"] + [0,0,1,0]
   *
   * NOTE: currently only decoding is implemented
   */
  enums?: Array<string[] | null>;

  /**
   * Holds integers between 0 and 999999, used by time-fields
   * to store the nanosecond-precision that cannot be represented
   * by the millisecond-based base value.
   */
  nanos?: Array<number[] | null>;
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
  fields: FieldSchema[];
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
 * Since JSON cannot encode NaN, Inf, -Inf, and undefined, the locations
 * of these entities in field value arrays are stored here for restoration
 * after JSON.parse()
 *
 * @alpha
 */
export interface FieldValueEntityLookup {
  NaN?: number[];
  Undef?: number[]; // Missing because of absence or join
  Inf?: number[];
  NegInf?: number[];
}

const ENTITY_MAP: Record<keyof FieldValueEntityLookup, number | undefined> = {
  Inf: Infinity,
  NegInf: -Infinity,
  Undef: undefined,
  NaN: NaN,
};

/**
 * @internal use locally
 */
export function decodeFieldValueEntities(lookup: FieldValueEntityLookup, values: FieldValues) {
  for (const key in lookup) {
    const repl = ENTITY_MAP[key as keyof FieldValueEntityLookup];
    for (const idx of lookup[key as keyof FieldValueEntityLookup]!) {
      if (idx < values.length) {
        values[idx] = repl;
      }
    }
  }
}

/**
 * @internal use locally
 */
export function decodeFieldValueEnums(lookup: string[], values: FieldValues) {
  for (let i = 0; i < values.length; i++) {
    values[i] = lookup[values[i] as number];
  }
}

function guessFieldType(name: string, values: FieldValues): FieldType {
  for (const v of values) {
    if (v != null) {
      return guessFieldTypeFromNameAndValue(name, v);
    }
  }
  return FieldType.other;
}

/**
 * NOTE: dto.data.values will be mutated and decoded/inflated using entities,bases,factors,enums
 *
 * @alpha
 */
export function dataFrameFromJSON(dto: DataFrameJSON): DataFrame {
  const { schema, data } = dto;

  if (!schema || !schema.fields) {
    throw new Error('JSON needs a fields definition');
  }

  // Find the longest field length
  const length = data ? data.values.reduce((max, vals) => Math.max(max, vals.length), 0) : 0;
  const fields = schema.fields.map((f, index) => {
    let buffer = data ? data.values[index] : [];
    let origLen = buffer.length;
    let type = f.type;

    if (origLen !== length) {
      buffer.length = length;
      // avoid sparse arrays
      buffer.fill(undefined, origLen);
    }

    let entities = data?.entities?.[index];

    if (entities) {
      decodeFieldValueEntities(entities, buffer);
    }

    let enums = data?.enums?.[index];

    if (enums) {
      decodeFieldValueEnums(enums, buffer);
      type = FieldType.string;
    }

    const nanos = data?.nanos?.[index];

    // TODO: expand arrays further using bases,factors

    const dataFrameField: Field & { entities: FieldValueEntityLookup } = {
      ...f,
      type: type ?? guessFieldType(f.name, buffer),
      config: f.config ?? {},
      values: buffer,
      // the presence of this prop is an optimization signal & lookup for consumers
      entities: entities ?? {},
    };

    if (nanos != null) {
      dataFrameField.nanos = nanos;
    }

    return dataFrameField;
  });

  return {
    ...schema,
    fields,
    length,
  };
}

/**
 * This converts DataFrame to a json representation with distinct schema+data
 *
 * @alpha
 */
export function dataFrameToJSON(frame: DataFrame): DataFrameJSON {
  const data: DataFrameData = {
    values: [],
  };

  const allNanos: Array<number[] | null> = [];
  let hasNanos = false;

  const schema: DataFrameSchema = {
    refId: frame.refId,
    meta: frame.meta,
    name: frame.name,
    fields: frame.fields.map((f) => {
      const { values, nanos, state, display, ...sfield } = f;
      delete (sfield as any).entities;
      data.values.push(values);

      if (nanos != null) {
        allNanos.push(nanos);
        hasNanos = true;
      } else {
        allNanos.push(null);
      }

      return sfield;
    }),
  };

  if (hasNanos) {
    data.nanos = allNanos;
  }

  return {
    schema,
    data,
  };
}
