import { Field, getFieldDisplayName } from '@grafana/data';

import { ROW_ACTION_BUTTON_WIDTH } from '../LogsTable';
import { DEFAULT_TIME_FIELD_WIDTH } from '../constants';

export function getFieldWidth(width: number | undefined, field: Field, fieldIndex: number, timeFieldName?: string) {
  if (width !== undefined) {
    return width;
  }

  return width ?? getDefaultFieldWidth(field, fieldIndex, timeFieldName);
}

function getDefaultFieldWidth(field: Field, fieldIndex: number, timeFieldName?: string): number | undefined {
  if (getFieldDisplayName(field) === timeFieldName) {
    if (fieldIndex === 0) {
      return DEFAULT_TIME_FIELD_WIDTH + ROW_ACTION_BUTTON_WIDTH;
    }
    return DEFAULT_TIME_FIELD_WIDTH;
  }

  return undefined;
}
