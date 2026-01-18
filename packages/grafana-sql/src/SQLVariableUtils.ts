import { Field, FieldType } from '@grafana/data';
import { EditorMode } from '@grafana/plugin-ui';

import { applyQueryDefaults } from './defaults';
import { type SQLQuery, type SQLVariableQuery, type SQLQueryMeta } from './types';

export const refId = 'SQLVariableQueryEditor-VariableQuery';

export const migrateVariableQuery = (rawQuery: string | SQLQuery): SQLVariableQuery => {
  if (typeof rawQuery !== 'string') {
    return {
      ...rawQuery,
      refId: rawQuery.refId || refId,
      query: rawQuery.rawSql || '',
    };
  }
  return {
    ...applyQueryDefaults({
      refId,
      rawSql: rawQuery,
      editorMode: rawQuery ? EditorMode.Code : EditorMode.Builder,
    }),
    query: rawQuery,
  };
};

export const convertFieldsToVariableFields = (original_fields: Field[], meta?: SQLQueryMeta): Field[] => {
  if (original_fields.length < 1) {
    throw new Error('at least one field expected for variable');
  }
  if (meta) {
    let tf = meta.textField ? original_fields.find((f) => f.name === meta.textField) : undefined;
    let vf = meta.valueField ? original_fields.find((f) => f.name === meta.valueField) : undefined;
    const textField = tf || vf || original_fields[0];
    const valueField = vf || tf || original_fields[0];
    const otherFields = original_fields.filter((f: Field) => f.name !== 'value' && f.name !== 'text');
    return [{ ...textField, name: 'text' }, { ...valueField, name: 'value' }, ...otherFields];
  }
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
  const values: string[] = [];
  for (const field of original_fields) {
    for (const value of field.values) {
      value === null || value === undefined ? values.push('') : values.push('' + value);
    }
  }
  return [
    { name: 'text', type: FieldType.string, config: {}, values },
    { name: 'value', type: FieldType.string, config: {}, values },
  ];
};
