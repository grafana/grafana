import React, { ReactNode } from 'react';

import { DataFrame } from '@grafana/data';

export type { Options } from './panelcfg.gen';

type onClickFilterLabelType = (key: string, value: string, frame?: DataFrame) => void;
type onClickFilterOutLabelType = (key: string, value: string, frame?: DataFrame) => void;
type onClickFilterValueType = (value: string, refId?: string) => void;
type onClickFilterOutStringType = (value: string, refId?: string) => void;
type isFilterLabelActiveType = (key: string, value: string, refId?: string) => Promise<boolean>;
type isOnClickShowFieldType = (value: string) => void;
type isOnClickHideFieldType = (value: string) => void;
export type onNewLogsReceivedType = (allLogs: DataFrame[], newLogs: DataFrame[]) => void;

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

export function isReactNodeArray(node: unknown): node is ReactNode[] {
  return Array.isArray(node) && node.every(React.isValidElement);
}
