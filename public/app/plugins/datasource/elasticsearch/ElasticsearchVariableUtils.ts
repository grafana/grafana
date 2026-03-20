import { DataFrame, Field, FieldType } from '@grafana/data';

import { ElasticsearchDataQuery } from './dataquery.gen';

export const refId = 'ElasticsearchVariableQueryEditor-VariableQuery';

export type ElasticsearchVariableQuery = ElasticsearchDataQuery;

export const migrateVariableQuery = (rawQuery: string | ElasticsearchDataQuery): ElasticsearchVariableQuery => {
  if (typeof rawQuery !== 'string') {
    return {
      ...rawQuery,
      refId: rawQuery.refId || refId,
      query: rawQuery.query || '',
      meta: rawQuery.meta,
    };
  }
  // Legacy string-based query
  return {
    refId,
    query: rawQuery,
    metrics: [{ type: 'raw_document', id: '1' }],
  };
};

export const updateFrame = (frame: DataFrame, meta?: { textField?: string; valueField?: string }): DataFrame => {
  const fields = convertFieldsToVariableFields(frame.fields, meta);
  let length = fields.length > 0 ? fields[0].values.length : frame.length;
  return { ...frame, length, fields };
};

const extractJsonProperty = (field: Field, key: string): Field | undefined => {
  const values = field.values.map((v) => {
    if (v === null || v === undefined) {
      return null;
    }
    try {
      const obj = typeof v === 'string' ? JSON.parse(v) : v;
      const val = obj?.[key];
      return val !== undefined ? String(val) : null;
    } catch {
      return null;
    }
  });
  return values.every((v) => v === null)
    ? undefined
    : { ...field, name: key, type: FieldType.string, values };
};

export const convertFieldsToVariableFields = (
  original_fields: Field[],
  meta?: { textField?: string; valueField?: string }
): Field[] => {
  // scenario 1: If no fields found, throw error
  if (original_fields.length < 1) {
    throw new Error('at least one field expected for variable');
  }

  // scenario 2: If meta field found, use and return (at least one text field / value field exist / or first field)
  if (meta?.textField || meta?.valueField) {
    let tf = meta.textField ? original_fields.find((f) => f.name === meta.textField) : undefined;
    let vf = meta.valueField ? original_fields.find((f) => f.name === meta.valueField) : undefined;

    // Named columns not found — the response may be a raw_document query where the backend
    // returns a single NullableJSON blob field rather than individual columns. Try to extract
    // the requested property from each JSON object in that blob field.
    const jsonBlobField = original_fields.find((f) => f.type === FieldType.other);
    if (jsonBlobField) {
      if (!tf && meta.textField) {
        tf = extractJsonProperty(jsonBlobField, meta.textField);
      }
      if (!vf && meta.valueField) {
        vf = extractJsonProperty(jsonBlobField, meta.valueField);
      }
    }

    const textField = tf || vf || original_fields[0];
    const valueField = vf || tf || original_fields[0];
    const otherFields = original_fields.filter((f: Field) => f.name !== 'value' && f.name !== 'text');
    return [{ ...textField, name: 'text' }, { ...valueField, name: 'value' }, ...otherFields];
  }

  // scenario 3: If both __text field & __value field found
  let tf = original_fields.find((f) => f.name === '__text');
  let vf = original_fields.find((f) => f.name === '__value');
  if (tf && vf) {
    const otherFields = original_fields.filter((f: Field) => f.name !== '__text' && f.name !== '__value');
    return [
      { ...tf, name: 'text', values: tf.values.map((v) => '' + v) },
      { ...vf, name: 'value', values: vf.values.map((v) => '' + v) },
      ...otherFields,
    ];
  }

  // scenario 4: fallback scenario / legacy scenario where return all fields into a single field.
  let values: string[] = [];
  for (const field of original_fields) {
    for (const value of field.values) {
      if (value !== null && value !== undefined) {
        values.push('' + value);
      }
    }
  }
  return [
    { name: 'text', type: FieldType.string, config: {}, values },
    { name: 'value', type: FieldType.string, config: {}, values },
  ];
};
