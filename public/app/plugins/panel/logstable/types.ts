import type { Options as TableOptions } from '../table/panelcfg.gen';

import type { Options as LogsTableOptions } from './panelcfg.gen';

export type onLogsTableOptionsChangeType = (option: LogsTableOptions & TableOptions) => void;
export function isOnLogsTableOptionsChange(callback: unknown): callback is onLogsTableOptionsChangeType {
  return typeof callback === 'function';
}
