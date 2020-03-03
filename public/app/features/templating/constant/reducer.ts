import { createReducer } from '@reduxjs/toolkit';
import { ConstantVariableModel, VariableHide, VariableOption } from '../variable';
import { emptyUuid, getInstanceState } from '../state/types';
import { createConstantOptionsFromQuery } from './actions';
import { initialVariablesState } from '../state/variablesReducer';

export const initialConstantVariableModelState: ConstantVariableModel = {
  uuid: emptyUuid,
  global: false,
  type: 'constant',
  name: '',
  hide: VariableHide.hideLabel,
  label: '',
  query: '',
  current: {} as VariableOption,
  options: [],
  skipUrlSync: false,
  index: -1,
  initLock: null,
};

export const constantVariableReducer = createReducer(initialVariablesState, builder =>
  builder.addCase(createConstantOptionsFromQuery, (state, action) => {
    const instanceState = getInstanceState<ConstantVariableModel>(state, action.payload.uuid);
    instanceState.options = [{ text: instanceState.query.trim(), value: instanceState.query.trim(), selected: false }];
  })
);
