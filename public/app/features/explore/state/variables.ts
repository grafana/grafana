import { createAction } from '@reduxjs/toolkit';
import { AnyAction } from 'redux';

import { ExploreItemState } from 'app/types/explore';

export interface AddVariablePayload {
  exploreId: string;
  name: string;
  values: string[];
}

export interface RemoveVariablePayload {
  exploreId: string;
  name: string;
}

export interface UpdateVariableSelectedValuePayload {
  exploreId: string;
  name: string;
  selectedValue: string;
}

export const addVariableAction = createAction<AddVariablePayload>('explore/addVariable');
export const removeVariableAction = createAction<RemoveVariablePayload>('explore/removeVariable');
export const updateVariableSelectedValueAction = createAction<UpdateVariableSelectedValuePayload>(
  'explore/updateVariableSelectedValue'
);

export const variablesReducer = (state: ExploreItemState, action: AnyAction): ExploreItemState => {
  if (addVariableAction.match(action)) {
    const { name, values } = action.payload;
    return {
      ...state,
      variables: [...state.variables, { name, values, selectedValue: values[0] }],
    };
  }

  if (removeVariableAction.match(action)) {
    const { name } = action.payload;
    return {
      ...state,
      variables: state.variables.filter((v) => v.name !== name),
    };
  }

  if (updateVariableSelectedValueAction.match(action)) {
    const { name, selectedValue } = action.payload;
    return {
      ...state,
      variables: state.variables.map((v) => (v.name === name ? { ...v, selectedValue } : v)),
    };
  }

  return state;
};
