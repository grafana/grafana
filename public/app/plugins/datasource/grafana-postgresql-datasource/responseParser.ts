import { uniqBy } from 'lodash';

import { DataFrame, Field, MetricFindValue } from '@grafana/data';

export function transformMetricFindResponse(frame: DataFrame): MetricFindValue[] {
  const textField = frame.fields.find((f) => f.name === '__text');
  const valueField = frame.fields.find((f) => f.name === '__value');

  let values: MetricFindValue[];

  if (textField && valueField) {
    const additionalFields = frame.fields.filter((f) => f.name !== '__text' && f.name !== '__value');
    values = buildMetricFindValues(textField, valueField, additionalFields);
  } else if (frame.fields.length > 0) {
    // Support multiple fields by first field as text/value and additional fields as properties
    const firstField = frame.fields[0];
    const additionalFields = frame.fields.slice(1);
    values = buildMetricFindValues(firstField, firstField, additionalFields);
  } else {
    values = [];
  }

  return uniqBy(values, 'text');
}

function buildMetricFindValues(textField: Field, valueField: Field, additionalFields: Field[]): MetricFindValue[] {
  const values: MetricFindValue[] = [];

  for (let i = 0; i < textField.values.length; i++) {
    const item: MetricFindValue = {
      text: '' + textField.values[i],
      value: '' + valueField.values[i],
    };

    const properties = buildProperties(additionalFields, i);
    if (properties) {
      item.properties = properties;
    }

    values.push(item);
  }

  return values;
}

function buildProperties(fields: Field[], rowIndex: number): Record<string, string> | undefined {
  if (fields.length === 0) {
    return undefined;
  }

  const properties: Record<string, string> = {};

  for (const field of fields) {
    // Skip fields named 'text' or 'value' to avoid conflicts with top-level fields
    if (field.name !== 'text' && field.name !== 'value') {
      properties[field.name] = '' + field.values[rowIndex];
    }
  }

  // Only return properties object if there are actual properties
  return Object.keys(properties).length > 0 ? properties : undefined;
}
