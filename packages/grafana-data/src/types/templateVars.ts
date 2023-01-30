import * as schema from '@grafana/schema';

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

export interface VariableOption {
  selected: boolean;
  text: string | string[];
  value: string | string[];
  isNone?: boolean;
}

export interface AdHocVariableModel extends schema.AdHocVariableModel {}
export interface DataSourceVariableModel extends schema.DataSourceVariableModel {}
export interface QueryVariableModel extends schema.QueryVariableModel {}
export interface TextBoxVariableModel extends schema.TextBoxVariableModel {}
export interface ConstantVariableModel extends schema.ConstantVariableModel {}
export interface CustomVariableModel extends schema.CustomVariableModel {}
export interface IntervalVariableModel extends schema.IntervalVariableModel {}
export interface VariableWithMultiSupport extends schema.VariableWithMultiSupport {}
export interface VariableWithOptions extends schema.VariableWithOptions {}
export interface BaseVariableModel extends schema.BaseVariableModel {}

export type DashboardProps = schema.DashboardSystemVariableModel['current']['value'] & {
  toString: () => string;
};

export type OrgProps = schema.OrgSystemVariableModel['current']['value'] & {
  toString: () => string;
};

export type UserProps = schema.UserSystemVariableModel['current']['value'] & {
  toString: () => string;
};

export interface SystemVariable<T extends { toString: () => string }> extends schema.SystemVariable<T> {}
export interface OrgVariableModel extends SystemVariable<OrgProps> {}
export interface UserVariableModel extends SystemVariable<UserProps> {}
export interface DashboardVariableModel extends SystemVariable<DashboardProps> {}
