import { ComponentType } from 'react';

import {
  BusEventWithPayload,
  DataQuery,
  DataSourceJsonData,
  DataSourceRef,
  LoadingState,
  QueryEditorProps,
  VariableModel as BaseVariableModel,
} from '@grafana/data';
import { TemplateSrv } from '@grafana/runtime';

import { NEW_VARIABLE_ID } from './constants';

// ---
// Base variable
export interface VariableModel extends BaseVariableModel {
  name: string;
  label?: string;
  id: string;
  rootStateKey: string | null;
  global: boolean;
  hide: VariableHide;
  skipUrlSync: boolean;
  index: number;
  state: LoadingState;
  error: any | null;
  description: string | null;
}

// ---
// Generic variable types
export interface VariableWithOptions extends VariableModel {
  current: VariableOption;
  options: VariableOption[];
  query: string;
}

export interface VariableWithMultiSupport extends VariableWithOptions {
  multi: boolean;
  includeAll: boolean;
  allValue?: string | null;
}

// ---
// Specific variable types
export interface QueryVariableModel extends VariableWithMultiSupport {
  type: 'query';
  datasource: DataSourceRef | null;
  definition: string;
  sort: VariableSort;
  queryValue?: string;
  query: any;
  regex: string;
  refresh: VariableRefresh;
}

export interface AdHocVariableModel extends VariableModel {
  type: 'adhoc';
  datasource: DataSourceRef | null;
  filters: AdHocVariableFilter[];
}

export interface ConstantVariableModel extends VariableWithOptions {
  type: 'constant';
}

export interface DataSourceVariableModel extends VariableWithMultiSupport {
  type: 'datasource';
  regex: string;
  refresh: VariableRefresh;
}

export interface IntervalVariableModel extends VariableWithOptions {
  type: 'interval';
  auto: boolean;
  auto_min: string;
  auto_count: number;
  refresh: VariableRefresh;
}

export interface TextBoxVariableModel extends VariableWithOptions {
  type: 'textbox';
  originalQuery: string | null;
}

export interface CustomVariableModel extends VariableWithMultiSupport {
  type: 'custom';
}

export interface SystemVariable<TProps extends { toString: () => string }> extends VariableModel {
  type: 'system';
  current: { value: TProps };
}

export interface UserVariableModel extends SystemVariable<UserProps> {}
export interface OrgVariableModel extends SystemVariable<OrgProps> {}
export interface DashboardVariableModel extends SystemVariable<DashboardProps> {}

export type TypedVariableModel =
  | QueryVariableModel
  | AdHocVariableModel
  | ConstantVariableModel
  | DataSourceVariableModel
  | IntervalVariableModel
  | TextBoxVariableModel
  | CustomVariableModel
  | UserVariableModel
  | OrgVariableModel
  | DashboardVariableModel;

//
// ----------------
//

export enum TransactionStatus {
  NotStarted = 'Not started',
  Fetching = 'Fetching',
  Completed = 'Completed',
}

export enum VariableRefresh {
  never, // removed from the UI
  onDashboardLoad,
  onTimeRangeChanged,
}

export enum VariableHide {
  dontHide,
  hideLabel,
  hideVariable,
}

export enum VariableSort {
  disabled,
  alphabeticalAsc,
  alphabeticalDesc,
  numericalAsc,
  numericalDesc,
  alphabeticalCaseInsensitiveAsc,
  alphabeticalCaseInsensitiveDesc,
}

export interface VariableOption {
  selected: boolean;
  text: string | string[];
  value: string | string[];
  isNone?: boolean;
}

export interface AdHocVariableFilter {
  key: string;
  operator: string;
  value: string;
  condition: string;
}

export interface DashboardProps {
  name: string;
  uid: string;
  toString: () => string;
}

export interface OrgProps {
  name: string;
  id: number;
  toString: () => string;
}

export interface UserProps {
  login: string;
  id: number;
  email?: string;
  toString: () => string;
}

export const initialVariableModelState: VariableModel = {
  id: NEW_VARIABLE_ID,
  rootStateKey: null,
  name: '',
  global: false,
  index: -1,
  hide: VariableHide.dontHide,
  skipUrlSync: false,
  state: LoadingState.NotStarted,
  error: null,
  description: null,
  type: 'query',
};

export interface VariableQueryEditorProps {
  query: any;
  onChange: (query: any, definition: string) => void;
  datasource: any;
  templateSrv: TemplateSrv;
}

export type VariableQueryEditorType<
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData
> = ComponentType<VariableQueryEditorProps> | ComponentType<QueryEditorProps<any, TQuery, TOptions, any>> | null;

export interface VariablesChangedEvent {
  refreshAll: boolean;
  panelIds: number[];
}

export class VariablesChanged extends BusEventWithPayload<VariablesChangedEvent> {
  static type = 'variables-changed';
}

export interface VariablesTimeRangeProcessDoneEvent {
  variableIds: string[];
}

export class VariablesTimeRangeProcessDone extends BusEventWithPayload<VariablesTimeRangeProcessDoneEvent> {
  static type = 'variables-time-range-process-done';
}

export class VariablesChangedInUrl extends BusEventWithPayload<VariablesChangedEvent> {
  static type = 'variables-changed-in-url';
}
