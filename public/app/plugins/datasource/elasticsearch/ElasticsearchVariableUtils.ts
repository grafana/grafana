import { DataFrame, Field, FieldType } from '@grafana/data';

import { ElasticsearchDataQuery } from './dataquery.gen';

export const refId = 'ElasticsearchVariableQueryEditor-VariableQuery';

export type ElasticsearchVariableQuery = ElasticsearchDataQuery;

// Shape of the old Grafana-syntax variable query, e.g. {"find":"terms","field":"Platform.keyword"}
export interface LegacyFindQuery {
  find: 'terms' | 'fields';
  field?: string;
  query?: string;
  size?: number;
  order?: 'asc' | 'desc';
  orderBy?: string;
  type?: string;
}

const isLegacyFindQuery = (v: unknown): v is LegacyFindQuery =>
  v !== null && typeof v === 'object' && 'find' in v && (v.find === 'terms' || v.find === 'fields');

export const parseLegacyFindQuery = (raw: string): LegacyFindQuery | null => {
  try {
    const parsed: unknown = JSON.parse(raw);
    return isLegacyFindQuery(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const migrateVariableQuery = (rawQuery: string | ElasticsearchDataQuery): ElasticsearchVariableQuery => {
  if (typeof rawQuery !== 'string') {
    return {
      ...rawQuery,
      refId: rawQuery.refId || refId,
      query: rawQuery.query || '',
      meta: rawQuery.meta,
    };
  }

  // Legacy Grafana-syntax query: {"find":"terms","field":"..."} or {"find":"fields",...}
  // Before ElasticsearchVariableSupport existed, these were handled by metricFindQuery().
  // Convert them to the equivalent structured query so the new editor handles them correctly.
  const legacy = parseLegacyFindQuery(rawQuery);
  if (legacy?.find === 'terms' && legacy.field) {
    return {
      refId,
      query: legacy.query ?? '',
      metrics: [{ type: 'count', id: '1' }],
      bucketAggs: [
        {
          type: 'terms',
          id: '2',
          field: legacy.field,
          settings: {
            size: String(legacy.size ?? 500),
            order: legacy.order ?? 'asc',
            orderBy: legacy.orderBy ?? '_term',
            min_doc_count: '1',
          },
        },
      ],
    };
  }

  // Legacy string-based Lucene query (plain text or unrecognised JSON)
  return {
    refId,
    query: rawQuery,
    queryType: 'legacy_variable',
    metrics: [{ type: 'raw_document', id: '1' }],
  };
};

export const updateFrame = (frame: DataFrame, meta?: { textField?: string; valueField?: string }): DataFrame => {
  const fields = convertFieldsToVariableFields(frame.fields, meta);
  let length = fields.length > 0 ? fields[0].values.length : frame.length;
  return { ...frame, length, fields };
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
