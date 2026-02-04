import { Field, getFieldDisplayName } from '@grafana/data';

import { DEFAULT_FIRST_FIELD_WIDTH, ROW_ACTION_BUTTON_WIDTH } from '../constants';

export function getFieldWidth(
  width: number | undefined,
  field: Field,
  fieldIndex: number,
  timeFieldName: string,
  showCopyLogLink: boolean,
  showInspectLogLine: boolean
) {
  if (width !== undefined) {
    return width;
  }

  return getDefaultFieldWidth(field, fieldIndex, timeFieldName, showCopyLogLink, showInspectLogLine);
}

function getDefaultFieldWidth(
  field: Field,
  fieldIndex: number,
  timeFieldName: string,
  showCopyLogLink: boolean,
  showInspectLogLine: boolean
): number | undefined {
  if (getFieldDisplayName(field) !== timeFieldName) {
    return undefined;
  }
  if (fieldIndex !== 0) {
    return undefined;
  }
  if (showInspectLogLine && showCopyLogLink) {
    return DEFAULT_FIRST_FIELD_WIDTH + ROW_ACTION_BUTTON_WIDTH;
  } else if (showInspectLogLine || showCopyLogLink) {
    return DEFAULT_FIRST_FIELD_WIDTH + ROW_ACTION_BUTTON_WIDTH / 2;
  }
  return DEFAULT_FIRST_FIELD_WIDTH;

  return undefined;
}
