import { uniqBy } from 'lodash';

import { DataFrame, Field, MetricFindValue } from '@grafana/data';

const RESERVED_PROPERTY_NAMES = ['text', 'value'];

export function transformMetricFindResponse(frame: DataFrame): MetricFindValue[] {
  const textField = frame.fields.find((f) => f.name === '__text');
  const valueField = frame.fields.find((f) => f.name === '__value');

  const values =
    textField && valueField
      ? buildValuesFromTextValueFields(textField, valueField, frame.fields)
      : buildValuesFromAllFields(frame.fields);

  return uniqBy(values, 'text');
}

function buildValuesFromTextValueFields(textField: Field, valueField: Field, allFields: Field[]): MetricFindValue[] {
  const additionalFields = allFields.filter((f) => f.name !== '__text' && f.name !== '__value');
  const values: MetricFindValue[] = [];

  for (let rowIndex = 0; rowIndex < textField.values.length; rowIndex++) {
    values.push(
      createMetricFindValue(
        '' + textField.values[rowIndex],
        '' + valueField.values[rowIndex],
        additionalFields,
        rowIndex
      )
    );
  }

  return values;
}

function buildValuesFromAllFields(fields: Field[]): MetricFindValue[] {
  const values: MetricFindValue[] = [];

  for (const field of fields) {
    for (let rowIndex = 0; rowIndex < field.values.length; rowIndex++) {
      values.push(createMetricFindValue(field.values[rowIndex], undefined, fields, rowIndex));
    }
  }

  return values;
}

function createMetricFindValue(
  text: unknown,
  value: string | undefined,
  fields: Field[],
  rowIndex: number
): MetricFindValue {
  const item: MetricFindValue = { text: '' + text };

  if (value !== undefined) {
    item.value = value;
  }

  const properties = buildProperties(fields, rowIndex);
  if (properties) {
    item.properties = properties;
  }

  return item;
}

function buildProperties(fields: Field[], rowIndex: number): Record<string, string> | undefined {
  if (fields.length === 0) {
    return undefined;
  }

  const properties: Record<string, string> = {};

  for (const field of fields) {
    if (!RESERVED_PROPERTY_NAMES.includes(field.name)) {
      properties[field.name] = '' + field.values[rowIndex];
    }
  }

  return Object.keys(properties).length > 0 ? properties : undefined;
}
