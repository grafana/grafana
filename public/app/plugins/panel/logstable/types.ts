import { CoreApp } from '@grafana/data';

import type { Options as TableOptions } from '../table/panelcfg.gen';

import type { Options as LogsTableOptions } from './panelcfg.gen';

export type OnLogsTableOptionsChange = (option: LogsTableOptions & TableOptions) => void;
export type BuildLinkToLogLine = (logId: string) => string | null;
export type LabelFilterActiveType = (key: string, value: string, refId?: string) => Promise<boolean>;

export function isOnLogsTableOptionsChange(callback: unknown): callback is OnLogsTableOptionsChange {
  return typeof callback === 'function';
}

export function isBuildLinkToLogLine(callback: unknown): callback is BuildLinkToLogLine {
  return typeof callback === 'function';
}

export function isIsLabelFilterActive(callback: unknown): callback is LabelFilterActiveType {
  return typeof callback === 'function';
}

export function isCoreApp(app: unknown): app is CoreApp {
  return typeof app === 'string' && app in CoreApp;
}
