import { Field } from '@grafana/data';

import { LogsFrame } from '../../../features/logs/logsFrame';
import type { Options as TableOptions } from '../table/panelcfg.gen';

import type { Options as LogsTableOptions } from './panelcfg.gen';

export type OnLogsTableOptionsChange = (option: LogsTableOptions & TableOptions) => void;
export type BuildLinkToLogLine = (logsFrame: LogsFrame, rowIndex: number, field: Field) => string;
export function isOnLogsTableOptionsChange(callback: unknown): callback is OnLogsTableOptionsChange {
  return typeof callback === 'function';
}

export function isBuildLinkToLogLine(callback: unknown): callback is BuildLinkToLogLine {
  return typeof callback === 'function';
}
