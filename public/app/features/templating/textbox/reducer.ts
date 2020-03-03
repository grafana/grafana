import { createReducer } from '@reduxjs/toolkit';

import { TextBoxVariableModel, VariableHide, VariableOption } from '../variable';
import { emptyUuid, getInstanceState, VariableState } from '../state/types';
import { initialTemplatingState } from '../state/reducers';
import { createTextBoxOptions } from './actions';

export interface TextBoxVariableState extends VariableState<TextBoxVariableModel> {}

export const initialTextBoxVariableModelState: TextBoxVariableModel = {
  uuid: emptyUuid,
  global: false,
  index: -1,
  type: 'textbox',
  name: '',
  label: '',
  hide: VariableHide.dontHide,
  query: '',
  current: {} as VariableOption,
  options: [],
  skipUrlSync: false,
  initLock: null,
};

export const initialTextBoxVariableState: TextBoxVariableState = {
  variable: initialTextBoxVariableModelState,
};

export const textBoxVariableReducer = createReducer(initialTemplatingState, builder =>
  builder.addCase(createTextBoxOptions, (state, action) => {
    const instanceState = getInstanceState<TextBoxVariableState>(state, action.payload.uuid!);
    instanceState.variable.options = [
      { text: instanceState.variable.query.trim(), value: instanceState.variable.query.trim(), selected: false },
    ];
    instanceState.variable.current = instanceState.variable.options[0];
  })
);
