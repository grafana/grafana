import { Field, getFieldDisplayName } from '@grafana/data';

import { ROW_ACTION_BUTTON_WIDTH } from '../LogsTable';
import { DEFAULT_FIRST_FIELD_WIDTH } from '../constants';
import type { Options as LogsTableOptions } from '../panelcfg.gen';

export function getFieldWidth(
  width: number | undefined,
  field: Field,
  fieldIndex: number,
  timeFieldName: string,
  options: LogsTableOptions
) {
  if (width !== undefined) {
    return width;
  }

  return width ?? getDefaultFieldWidth(field, fieldIndex, timeFieldName, options);
}

function getDefaultFieldWidth(
  field: Field,
  fieldIndex: number,
  timeFieldName: string,
  options: LogsTableOptions
): number | undefined {
  if (getFieldDisplayName(field) === timeFieldName) {
    if (fieldIndex === 0) {
      if (options.showInspectLogLine || options.showCopyLogLink) {
        if (options.showInspectLogLine && options.showCopyLogLink) {
          return DEFAULT_FIRST_FIELD_WIDTH + ROW_ACTION_BUTTON_WIDTH;
        }

        return DEFAULT_FIRST_FIELD_WIDTH + ROW_ACTION_BUTTON_WIDTH / 2;
      }
    }
    return DEFAULT_FIRST_FIELD_WIDTH;
  }

  return undefined;
}
