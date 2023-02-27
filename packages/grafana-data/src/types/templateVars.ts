import { LoadingState } from './data';
import { DataSourceRef } from './query';

export type VariableType = TypedVariableModel['type'];

/** @deprecated Use TypedVariableModel instead */
export interface VariableModel {
  type: VariableType;
  name: string;
  label?: string;
}

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

export enum VariableRefresh {
  never, // removed from the UI
  onDashboardLoad,
  onTimeRangeChanged,
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

export enum VariableHide {
  dontHide,
  hideLabel,
  hideVariable,
}

export interface AdHocVariableFilter {
  key: string;
  operator: string;
  value: string;
  condition: string;
}

export interface AdHocVariableModel extends BaseVariableModel {
  type: 'adhoc';
  datasource: DataSourceRef | null;
  filters: AdHocVariableFilter[];
}

export interface VariableOption {
  selected: boolean;
  text: string | string[];
  value: string | string[];
  isNone?: boolean;
}

export interface IntervalVariableModel extends VariableWithOptions {
  type: 'interval';
  auto: boolean;
  auto_min: string;
  auto_count: number;
  refresh: VariableRefresh;
}

export interface CustomVariableModel extends VariableWithMultiSupport {
  type: 'custom';
}

export interface DataSourceVariableModel extends VariableWithMultiSupport {
  type: 'datasource';
  regex: string;
  refresh: VariableRefresh;
}

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

export interface TextBoxVariableModel extends VariableWithOptions {
  type: 'textbox';
  originalQuery: string | null;
}

export interface ConstantVariableModel extends VariableWithOptions {
  type: 'constant';
}

export interface VariableWithMultiSupport extends VariableWithOptions {
  multi: boolean;
  includeAll: boolean;
  allValue?: string | null;
}

export interface VariableWithOptions extends BaseVariableModel {
  current: VariableOption;
  options: VariableOption[];
  query: string;
}

export interface DashboardProps {
  name: string;
  uid: string;
  toString: () => string;
}

export interface DashboardVariableModel extends SystemVariable<DashboardProps> {}

export interface OrgProps {
  name: string;
  id: number;
  toString: () => string;
}

export interface OrgVariableModel extends SystemVariable<OrgProps> {}

export interface UserProps {
  login: string;
  id: number;
  email?: string;
  toString: () => string;
}

export interface UserVariableModel extends SystemVariable<UserProps> {}

export interface SystemVariable<TProps extends { toString: () => string }> extends BaseVariableModel {
  type: 'system';
  current: { value: TProps };
}

export interface BaseVariableModel {
  name: string;
  label?: string;
  id: string;
  type: VariableType;
  rootStateKey: string | null;
  global: boolean;
  hide: VariableHide;
  skipUrlSync: boolean;
  index: number;
  state: LoadingState;
  error: any | null;
  description: string | null;
}
