import { DataFrame, FieldType } from '@grafana/data';

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
