import { uniqBy } from 'lodash';

import { DataFrame, MetricFindValue } from '@grafana/data';

import type { ResponseParser as ResponseParserType } from './types';

export class ResponseParser implements ResponseParserType {
  transformMetricFindResponse(frame: DataFrame): MetricFindValue[] {
    const values: MetricFindValue[] = [];
    const textField = frame.fields.find((f) => f.name === '__text');
    const valueField = frame.fields.find((f) => f.name === '__value');

    if (textField && valueField) {
      for (let i = 0; i < textField.values.length; i++) {
        values.push({ text: '' + textField.values[i], value: '' + valueField.values[i] });
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
}
