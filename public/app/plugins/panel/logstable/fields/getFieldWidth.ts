import { DEFAULT_FIRST_FIELD_WIDTH, ROW_ACTION_BUTTON_WIDTH } from '../constants';
import type { Options as LogsTableOptions } from '../panelcfg.gen';

export function getFieldWidth(width: number | undefined, fieldIndex: number, options: LogsTableOptions) {
  if (width !== undefined) {
    return width;
  }

  return getDefaultFieldWidth(fieldIndex, options);
}

function getDefaultFieldWidth(fieldIndex: number, options: LogsTableOptions): number | undefined {
  if (fieldIndex !== 0) {
    return undefined;
  }

  if (options.showInspectLogLine && options.showCopyLogLink) {
    return DEFAULT_FIRST_FIELD_WIDTH + ROW_ACTION_BUTTON_WIDTH;
  } else if (options.showInspectLogLine || options.showCopyLogLink) {
    return DEFAULT_FIRST_FIELD_WIDTH + ROW_ACTION_BUTTON_WIDTH / 2;
  }
  return DEFAULT_FIRST_FIELD_WIDTH;

  return undefined;
}
