import { Deferred } from '../../core/utils/deferred';
import { VariableModel as BaseVariableModel } from '@grafana/data';

export enum VariableRefresh {
  never,
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

export interface VariableTag {
  selected: boolean;
  text: string | string[];
  values?: any[];
  valuesText?: string;
}

export interface VariableOption {
  selected: boolean;
  text: string | string[];
  value: string | string[];
  isNone?: boolean;
  tags?: VariableTag[];
}

export interface AdHocVariableFilter {
  key: string;
  operator: string;
  value: string;
  condition: string;
}

export interface AdHocVariableModel extends VariableModel {
  datasource: string | null;
  filters: AdHocVariableFilter[];
}

export interface IntervalVariableModel extends VariableWithOptions {
  auto: boolean;
  auto_min: string;
  auto_count: number;
  refresh: VariableRefresh;
}

export interface CustomVariableModel extends VariableWithMultiSupport {}

export interface DataSourceVariableModel extends VariableWithMultiSupport {
  regex: string;
  refresh: VariableRefresh;
}

export interface QueryVariableModel extends DataSourceVariableModel {
  datasource: string | null;
  definition: string;
  sort: VariableSort;
  tags: VariableTag[];
  tagsQuery: string;
  tagValuesQuery: string;
  useTags: boolean;
  queryValue?: string;
}

export interface TextBoxVariableModel extends VariableWithOptions {}

export interface ConstantVariableModel extends VariableWithOptions {}

export interface VariableWithMultiSupport extends VariableWithOptions {
  multi: boolean;
  includeAll: boolean;
  allValue?: string | null;
}

export interface VariableWithOptions extends VariableModel {
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
  toString: () => string;
}

export interface UserVariableModel extends SystemVariable<UserProps> {}

export interface SystemVariable<TProps extends { toString: () => string }> extends VariableModel {
  current: { value: TProps };
}

export interface VariableModel extends BaseVariableModel {
  id: string;
  global: boolean;
  hide: VariableHide;
  skipUrlSync: boolean;
  index: number;
  initLock?: Deferred | null;
}
