import { map } from 'rxjs/operators';

import { type DataFrame, FieldType } from '@grafana/data';
import { type CustomTransformOperator } from '@grafana/scenes';

// Pending must sit below firing in the stack. Sort frame references only — no value copying.
const ALERT_STATE_ORDER = ['pending', 'firing'];

export function alertStateFrameOrder(a: DataFrame, b: DataFrame): number {
  const aState = a.fields.find((f) => f.type !== 'time')?.labels?.alertstate ?? '';
  const bState = b.fields.find((f) => f.type !== 'time')?.labels?.alertstate ?? '';
  return ALERT_STATE_ORDER.indexOf(aState) - ALERT_STATE_ORDER.indexOf(bState);
}

export const sortByAlertState: CustomTransformOperator = () => (source) =>
  source.pipe(map((frames) => frames.slice().sort(alertStateFrameOrder)));

/**
 * Convert an instant-query DataFrame (one field per label, one row per instance)
 * into an array of label maps suitable for computeLabelStats.
 */
export function dataFrameToLabelMaps(frame: DataFrame): Array<Record<string, string>> {
  const labelFields = frame.fields.filter((f) => f.type === FieldType.string);
  const result: Array<Record<string, string>> = [];
  for (let i = 0; i < frame.length; i++) {
    const labels: Record<string, string> = {};
    for (const field of labelFields) {
      const value = field.values[i];
      // Skip empty/null values — in the table format every series gets a column
      // for every label key, but empty means the label wasn't present on that series.
      if (value !== null && value !== undefined && value !== '') {
        labels[field.name] = String(value);
      }
    }
    result.push(labels);
  }
  return result;
}
