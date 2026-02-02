import { Dispatch } from 'react';
import { Action } from 'redux';

import { SelectableValue } from '@grafana/data';
import { t } from 'app/core/internationalization';

export enum SearchLayout {
  List = 'list',
  Module = 'module',
}

export enum FieldType {
  OOTB = 'OOTB',
  Custom = 'CUSTOM',
}

export const typeMap: any = {
  OOTB: t('bmc.calc-fields.ootb', 'Out-of-the-box'),
  CUSTOM: t('bmc.calc-fields.custom', 'Custom'),
};

export interface CalcFieldModule {
  id: number;
  title: string;
  expanded?: boolean;
  icon?: string;
  items: CalcFieldItem[];
  toggle?: (section: CalcFieldModule) => Promise<CalcFieldModule>;
}

export interface CalcFieldItem {
  checked?: boolean;
  fieldId: number | string;
  selected?: boolean;
  formName: string;
  name: string;
  module: string;
  sqlQuery: string;
  Aggregation: boolean;
  field_type?: FieldType.OOTB | FieldType.Custom;
}

export interface SearchAction extends Action {
  payload?: any;
}

export interface SearchQuery {
  query: string;
  sort: SelectableValue | null;
  layout: SearchLayout;
  filterType: string;
  dsInstanceUrl?: string;
  calcFieldErr?: string;
}

export type SearchReducer<S> = [S, Dispatch<SearchAction>];

export type UseSearch = <S>(
  query: SearchQuery,
  reducer: SearchReducer<S>,
  queryDispatch: any
) => {
  state: S;
  dispatch: Dispatch<SearchAction>;
  onToggleSection: (section: CalcFieldModule) => void;
  onDeleteItems: OnDeleteItems;
};

export type OnToggleChecked = (item: CalcFieldItem | CalcFieldModule) => void;
export type OnDeleteItems = (str: number[]) => Promise<void>;
// Action for clone or edit
export type OnItemAction = (action: string) => void;

export interface CalcFields {
  name: string;
  formName: string;
  module: string;
  sqlQuery: string;
  Aggregation: boolean;
  rawQueryValidated?: boolean;
  fieldId?: number | string;
}

export enum ModifyActions {
  ADD = 'new',
  CLONE = 'clone',
  EDIT = 'edit',
}

export interface FormColumn {
  name: string;
  field_option: string;
}
