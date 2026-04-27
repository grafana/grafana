import { LogLevel } from '@grafana/data';
import { type Field, FieldType } from '@grafana/data/dataframe';
import { getLogLevelFromKey } from 'app/features/logs/utils';

/**
 * Normalizes level column values to canonical {@link LogLevel} strings, matching
 * {@link getLogLevelFromKey} / logs row parsing in the logs pipeline.
 */
export function normalizeLogLevelFieldInPlace(field: Field): void {
  if (field.type !== FieldType.string && field.type !== FieldType.number) {
    return;
  }

  const { values } = field;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v === null || v === undefined) {
      values[i] = LogLevel.unknown;
      continue;
    }
    values[i] = getLogLevelFromKey(typeof v === 'number' ? v : String(v));
  }

  field.type = FieldType.string;
}
