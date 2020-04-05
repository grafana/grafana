import { assignModelProperties } from 'app/core/utils/model_utils';
import { Deferred } from '../../core/utils/deferred';

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

export type VariableType = 'query' | 'adhoc' | 'constant' | 'datasource' | 'interval' | 'textbox' | 'custom';

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

export interface VariableModel {
  id?: string; // only exists for variables in redux state
  global?: boolean; // only exists for variables in redux state
  type: VariableType;
  name: string;
  label: string | null;
  hide: VariableHide;
  skipUrlSync: boolean;
  index?: number;
  initLock?: Deferred | null;
}

export interface VariableActions {
  setValue(option: any): any;
  updateOptions(searchFilter?: string): any;
  dependsOn(variable: any): any;
  setValueFromUrl(urlValue: any): any;
  getValueForUrl(): any;
  getSaveModel(): any;
}

export type CtorType = new (...args: any[]) => {};

export interface VariableTypes {
  [key: string]: {
    name: string;
    ctor: CtorType;
    description: string;
    supportsMulti?: boolean;
  };
}

export let variableTypes: VariableTypes = {};
export { assignModelProperties };
