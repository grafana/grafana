import { DataFrame, FieldType, FieldConfig, Labels, QueryResultMeta } from '../types';
import { ArrayVector } from '../vector';
import { vectorToArray } from '../vector/vectorToArray';
import { guessFieldTypeFromNameAndValue } from './processDataFrame';

/**
 * JSON does not support these value types
 *
 * @alpha
 */
export enum DataFrameReplacementValue {
  NaN = 'NaN',
  Undefined = 'Undef',
  Infinity = 'Inf',
  NegInf = 'NegInf',
}

/**
 * @alpha
 */
export interface DataFrameReplacement {
  value: DataFrameReplacementValue;
  field: number;
  rows: number[];
}

/**
 * Like a field, but properties are optional and values may be a simple array
 */
export interface FieldDTO {
  name: string; // The column name
  type?: FieldType;
  config?: FieldConfig;
  labels?: Labels;
  values: any[]; // Converted to vector in real DataFrame
}

export interface DataFrameDTO {
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
  fields: FieldDTO[];

  /**
   * replacement functions for the incoming data (fixes json limitations)
   */
  replace?: DataFrameReplacement[];
}

export function getReplacementValue(v: DataFrameReplacementValue): any {
  switch (v) {
    case DataFrameReplacementValue.Infinity:
      return Number.POSITIVE_INFINITY;
    case DataFrameReplacementValue.NegInf:
      return Number.NEGATIVE_INFINITY;
    case DataFrameReplacementValue.Undefined:
      return undefined;
    case DataFrameReplacementValue.NaN:
      return NaN;
  }
  return undefined; // should not be possible
}

function applyReplacements(msg: DataFrameDTO) {
  if (!msg.replace?.length) {
    return;
  }

  for (const r of msg.replace) {
    const val = getReplacementValue(r.value);
    const col = msg.fields[r.field].values;
    for (const idx of r.rows) {
      col[idx] = val;
    }
  }
}

function guessFieldType(idx: number, dto: DataFrameDTO): FieldType {
  const name = dto.fields[idx].name;
  for (const v of dto.fields[idx].values) {
    if (v != null) {
      return guessFieldTypeFromNameAndValue(name, v);
    }
  }

  return FieldType.other;
}

/**
 * NOTE: the data array may be mutated applying any replacement funciton defined
 */
export function dataFrameFromDTO(dto: DataFrameDTO): DataFrame {
  applyReplacements(dto);

  const fields = dto.fields.map((f, index) => ({
    ...f,
    type: f.type ?? guessFieldType(index, dto),
    config: f.config ?? {},
    values: new ArrayVector(dto.fields[index].values),
  }));
  return {
    refId: dto.refId,
    meta: dto.meta,
    fields,
    length: fields[0].values.length,
  };
}

/**
 * Returns a copy that does not include functions
 */
export function toDataFrameDTO(data: DataFrame): DataFrameDTO {
  const fields: FieldDTO[] = data.fields.map((f) => {
    let values = f.values.toArray();
    // The byte buffers serialize like objects
    if (values instanceof Float64Array) {
      values = vectorToArray(f.values);
    }
    return {
      name: f.name,
      type: f.type,
      config: f.config,
      values,
      labels: f.labels,
    };
  });

  return {
    fields,
    refId: data.refId,
    meta: data.meta,
    name: data.name,
  };
}
