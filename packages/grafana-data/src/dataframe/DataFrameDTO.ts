import { DataFrame, FieldType, FieldConfig, Labels, QueryResultMeta } from '../types';
import { ArrayVector } from '../vector';
import { vectorToArray } from '../vector/vectorToArray';
import { guessFieldTypeFromNameAndValue } from './processDataFrame';

/**
 * Since JSON does not support encoding some numeric types, we need to replace them on load.
 * While some system solve this by encoding everythign as strings, this approach lets is
 * efficiently communicate which values needed special encoding.
 *
 * @alpha
 */
export interface DataFrameReplacements {
  NaN?: number[];
  Undef?: number[]; // Missing because of absense or join
  Inf?: number[];
  NegInf?: number[];
}

/**
 * Field object passed over JSON
 *
 * @alpha
 */
export interface FieldDTO {
  name: string; // The column name
  type?: FieldType;
  config?: FieldConfig;
  labels?: Labels;
  values: any[]; // Converted to a vector

  // These values were replaced with nulls while encoding and need to be converted on load
  replaced?: DataFrameReplacements;
}

/**
 * The JSON transfer object for DataFrames.  Values are stored in simple JSON
 *
 * @alpha
 */
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
}

export function getReplacementValue(v: keyof DataFrameReplacements): any {
  switch (v) {
    case 'Inf':
      return Number.POSITIVE_INFINITY;
    case 'NegInf':
      return Number.NEGATIVE_INFINITY;
    case 'Undef':
      return undefined;
    case 'NaN':
      return NaN;
  }
  return undefined; // should not be possible
}

function applyReplacements(field: FieldDTO) {
  if (!field.replaced) {
    return;
  }

  for (const key of Object.keys(field.replaced)) {
    const val = getReplacementValue(key as keyof DataFrameReplacements);
    for (const idx of field.replaced[key as keyof DataFrameReplacements]!) {
      field.values[idx] = val;
    }
  }
}

function guessFieldType(field: FieldDTO): FieldType {
  for (const v of field.values) {
    if (v != null) {
      return guessFieldTypeFromNameAndValue(field.name, v);
    }
  }
  return FieldType.other;
}

/**
 * NOTE: data in the original array will be replaced with values from the DataFrameReplacements property
 *
 * @alpha
 */
export function dataFrameFromDTO(dto: DataFrameDTO): DataFrame {
  let length = 0;
  for (const f of dto.fields) {
    let flen = f.values?.length;
    if (flen && flen > length) {
      length = flen;
    }
  }

  const fields = dto.fields.map((f, index) => {
    if (f.replaced) {
      applyReplacements(f);
    }
    f.values.length = length; // will pad with undefined
    return {
      ...f,
      replaced: f.replaced ?? {},
      type: f.type ?? guessFieldType(f),
      config: f.config ?? {},
      values: new ArrayVector(f.values),
    };
  });
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
