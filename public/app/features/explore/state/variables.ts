import { createAction } from '@reduxjs/toolkit';
import { AnyAction } from 'redux';

import { ScopedVars } from '@grafana/data';
import { CustomVariable, SceneVariableSet } from '@grafana/scenes';
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

export const addVariableAction = createAction<AddVariablePayload>('explore/addVariable');
export const removeVariableAction = createAction<RemoveVariablePayload>('explore/removeVariable');

export function buildExploreVariableScopedVars(variableSet: SceneVariableSet): ScopedVars {
  const scopedVars: ScopedVars = {};
  for (const v of variableSet.state.variables) {
    scopedVars[v.state.name] = { text: v.getValueText?.() ?? '', value: v.getValue() };
  }
  return scopedVars;
}

export const variablesReducer = (state: ExploreItemState, action: AnyAction): ExploreItemState => {
  if (addVariableAction.match(action)) {
    const { name, values } = action.payload;
    const query = values.join(',');
    const variable = new CustomVariable({
      name,
      query,
      value: values[0] ?? '',
      text: values[0] ?? '',
      options: values.map((v) => ({ label: v || '(empty)', value: v })),
    });
    const newSet = new SceneVariableSet({
      variables: [...state.variableSet.state.variables, variable],
    });
    return { ...state, variableSet: newSet };
  }

  if (removeVariableAction.match(action)) {
    const { name } = action.payload;
    const newSet = new SceneVariableSet({
      variables: state.variableSet.state.variables.filter((v) => v.state.name !== name),
    });
    return { ...state, variableSet: newSet };
  }

  return state;
};
