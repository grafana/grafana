import * as schema from '@grafana/schema';

import { LoadingState } from './data';

export type VariableType = TypedVariableModel['type'];

/** @deprecated Use TypedVariableModel instead */
export interface VariableModel {
  type: VariableType;
  name: string;
  label?: string;
}

export type TypedVariableModel =
  | schema.QueryVariableModel
  | schema.AdHocVariableModel
  | schema.ConstantVariableModel
  | schema.DataSourceVariableModel
  | schema.IntervalVariableModel
  | schema.TextBoxVariableModel
  | schema.CustomVariableModel
  // FIXME: These are not in the schema beacuse it declares toString as part of the value, which is not necessary to declare in the schema.
  // We should override the value to add toString at this level to not introduce breaking changes.
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

export interface AdHocVariableModel extends schema.AdHocVariableModel {}

export interface VariableOption {
  selected: boolean;
  text: string | string[];
  value: string | string[];
  isNone?: boolean;
}

export interface DataSourceVariableModel extends schema.DataSourceVariableModel {}
export interface QueryVariableModel extends schema.QueryVariableModel {}
export interface TextBoxVariableModel extends schema.TextBoxVariableModel {}
export interface ConstantVariableModel extends schema.ConstantVariableModel {}
export interface CustomVariableModel extends schema.CustomVariableModel {}
export interface IntervalVariableModel extends schema.IntervalVariableModel {}
export interface VariableWithMultiSupport extends schema.VariableWithMultiSupport {}
export interface VariableWithOptions extends schema.VariableWithOptions {}
export interface DashboardVariableModel extends schema.DashboardSystemVariableModel {
  current: { value: schema.DashboardSystemVariableModel['current']['value'] & { toString: () => string } };
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
