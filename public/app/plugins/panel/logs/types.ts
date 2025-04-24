import React, { ReactNode } from 'react';

import { CoreApp, DataFrame, Field, LinkModel, ScopedVars } from '@grafana/data';
import { LogListControlOptions } from 'app/features/logs/components/panel/LogList';

export type { Options } from './panelcfg.gen';

type onClickFilterLabelType = (key: string, value: string, frame?: DataFrame) => void;
type onClickFilterOutLabelType = (key: string, value: string, frame?: DataFrame) => void;
type onClickFilterValueType = (value: string, refId?: string) => void;
type onClickFilterOutStringType = (value: string, refId?: string) => void;
type isFilterLabelActiveType = (key: string, value: string, refId?: string) => Promise<boolean>;
type isOnClickShowFieldType = (value: string) => void;
type isOnClickHideFieldType = (value: string) => void;
export type onNewLogsReceivedType = (allLogs: DataFrame[], newLogs: DataFrame[]) => void;
type onLogOptionsChangeType = (option: keyof LogListControlOptions, value: string | boolean | string[]) => void;

export type GetFieldLinksFn = (
  field: Field,
  rowIndex: number,
  dataFrame: DataFrame,
  vars: ScopedVars
) => Array<LinkModel<Field>>;

export function isOnClickFilterLabel(callback: unknown): callback is onClickFilterLabelType {
  return typeof callback === 'function';
}

export function isOnClickFilterOutLabel(callback: unknown): callback is onClickFilterOutLabelType {
  return typeof callback === 'function';
}

export function isOnClickFilterString(callback: unknown): callback is onClickFilterValueType {
  return typeof callback === 'function';
}

export function isOnClickFilterOutString(callback: unknown): callback is onClickFilterOutStringType {
  return typeof callback === 'function';
}

export function isIsFilterLabelActive(callback: unknown): callback is isFilterLabelActiveType {
  return typeof callback === 'function';
}

export function isOnClickShowField(callback: unknown): callback is isOnClickShowFieldType {
  return typeof callback === 'function';
}

export function isOnClickHideField(callback: unknown): callback is isOnClickHideFieldType {
  return typeof callback === 'function';
}

export function isOnNewLogsReceivedType(callback: unknown): callback is onNewLogsReceivedType {
  return typeof callback === 'function';
}

export function isOnLogOptionsChange(callback: unknown): callback is onLogOptionsChangeType {
  return typeof callback === 'function';
}

export function isReactNodeArray(node: unknown): node is ReactNode[] {
  return Array.isArray(node) && node.every(React.isValidElement);
}

export function isCoreApp(app: unknown): app is CoreApp {
  const apps = Object.values(CoreApp).map((coreApp) => coreApp.toString());
  return typeof app === 'string' && apps.includes(app);
}
