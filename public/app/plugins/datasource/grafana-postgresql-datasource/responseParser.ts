import { uniqBy } from 'lodash';

import { DataFrame, Field, MetricFindValue } from '@grafana/data';

const RESERVED_PROPERTY_NAMES = ['text', 'value', '__text', '__value'];

export function transformMetricFindResponse(frame: DataFrame): MetricFindValue[] {
  const values: MetricFindValue[] = [];
  const textField = frame.fields.find((f) => f.name === '__text');
  const valueField = frame.fields.find((f) => f.name === '__value');

  if (textField && valueField) {
    for (let i = 0; i < textField.values.length; i++) {
      values.push({ text: '' + textField.values[i], value: '' + valueField.values[i] });

      const properties = buildProperties(frame.fields, i);
      if (properties) {
        values[i].properties = properties;
      }
    }
  } else {
    for (const field of frame.fields) {
      for (const value of field.values) {
        values.push({ text: value });
      }
    }
  }

  return uniqBy(values, 'text');
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
