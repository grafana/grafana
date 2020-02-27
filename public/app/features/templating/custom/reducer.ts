import { createReducer } from '@reduxjs/toolkit';
import _ from 'lodash';
import { DataSourceApi } from '@grafana/data';
import { VariableHide, VariableOption, VariableTag, CustomVariableModel } from '../variable';
import { addVariable, updateVariableQuery } from '../state/actions';
import {
  emptyUuid,
  initialVariableEditorState,
  VariableEditorState,
  VariableState,
  getInstanceState,
} from '../state/types';
import { ComponentType } from 'react';
import { VariableQueryProps } from '../../../types';
import { initialTemplatingState } from '../state/reducers';

export type MutateStateFunc<S extends VariableState> = (state: S) => S;
export const applyStateChanges = <S extends VariableState>(state: S, ...args: Array<MutateStateFunc<S>>): S => {
  return args.reduce((all, cur) => {
    return cur(all);
  }, state);
};

export interface CustomVariablePickerState {
  showDropDown: boolean;
  selectedValues: VariableOption[];
  selectedTags: VariableTag[];
  searchQuery: string | null;
  highlightIndex: number;
  tags: VariableTag[];
  options: VariableOption[];
  oldVariableText: string | string[] | null;
}

export interface CustomVariableEditorState extends VariableEditorState {
  VariableQueryEditor: ComponentType<VariableQueryProps> | null;
  dataSource: DataSourceApi | null;
}

export interface CustomVariableState
  extends VariableState<CustomVariablePickerState, CustomVariableEditorState, CustomVariableModel> {}

export const initialCustomVariablePickerState: CustomVariablePickerState = {
  highlightIndex: -1,
  searchQuery: null,
  selectedTags: [],
  selectedValues: [],
  showDropDown: false,
  tags: [],
  options: [],
  oldVariableText: null,
};

export const initialCustomVariableModelState: CustomVariableModel = {
  uuid: emptyUuid,
  global: false,
  multi: false,
  includeAll: false,
  allValue: null,
  query: '',
  options: [],
  current: {} as VariableOption,
  name: '',
  type: 'custom',
  label: null,
  hide: VariableHide.dontHide,
  skipUrlSync: false,
  index: -1,
  initLock: null,
};

export const initialCustomVariableEditorState: CustomVariableEditorState = {
  ...initialVariableEditorState,
  VariableQueryEditor: null,
  dataSource: null,
};

export const initialCustomVariableState: CustomVariableState = {
  picker: initialCustomVariablePickerState,
  editor: initialCustomVariableEditorState,
  variable: initialCustomVariableModelState,
};

/**
 * TODO:
 * Should be moved somewhere so we can reference them in both custom
 * and query reducer. Copy/paste just to get something working.
 */
export const ALL_VARIABLE_TEXT = 'All';
export const ALL_VARIABLE_VALUE = '$__all';
export const NONE_VARIABLE_TEXT = 'None';
export const NONE_VARIABLE_VALUE = '';

export const customVariableReducer = createReducer(initialTemplatingState, builder =>
  builder
    .addCase(addVariable, (state, action) => {})
    .addCase(updateVariableQuery, (state, action) => {
      const instanceState = getInstanceState<CustomVariableState>(state, action.payload.uuid);
      const query = action.payload.data ?? instanceState.variable.query ?? '';
      const { includeAll } = instanceState.variable;

      const options = query.match(/(?:\\,|[^,])+/g).map(text => {
        text = text.replace(/\\,/g, ',');
        return { text: text.trim(), value: text.trim(), selected: false };
      });

      if (includeAll) {
        options.unshift({ text: ALL_VARIABLE_TEXT, value: ALL_VARIABLE_VALUE, selected: false });
      }

      instanceState.variable.options = options;
      instanceState.variable.query = query;
    })
);
