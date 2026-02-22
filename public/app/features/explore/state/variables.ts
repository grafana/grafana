import { createAction } from '@reduxjs/toolkit';
import { AnyAction } from 'redux';

import { ScopedVars } from '@grafana/data';
import { SceneVariable, SceneVariableSet } from '@grafana/scenes';
import { ExploreItemState } from 'app/types/explore';

export interface AddSceneVariablePayload {
  exploreId: string;
  variable: SceneVariable;
}

export interface RemoveVariablePayload {
  exploreId: string;
  name: string;
}

export interface ReplaceVariablePayload {
  exploreId: string;
  oldName: string;
  variable: SceneVariable;
}

export interface SetVariablesPayload {
  exploreId: string;
  variables: SceneVariable[];
}

export const addSceneVariableAction = createAction<AddSceneVariablePayload>('explore/addSceneVariable');
export const removeVariableAction = createAction<RemoveVariablePayload>('explore/removeVariable');
export const replaceVariableAction = createAction<ReplaceVariablePayload>('explore/replaceVariable');
export const setVariablesAction = createAction<SetVariablesPayload>('explore/setVariables');

export function buildExploreVariableScopedVars(variableSet: SceneVariableSet): ScopedVars {
  const scopedVars: ScopedVars = {};
  for (const v of variableSet.state.variables) {
    scopedVars[v.state.name] = { text: v.getValueText?.() ?? '', value: v.getValue() };
  }
  return scopedVars;
}

export const variablesReducer = (state: ExploreItemState, action: AnyAction): ExploreItemState => {
  if (addSceneVariableAction.match(action)) {
    const { variable } = action.payload;
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

  if (replaceVariableAction.match(action)) {
    const { oldName, variable } = action.payload;
    const newSet = new SceneVariableSet({
      variables: state.variableSet.state.variables.map((v) => (v.state.name === oldName ? variable : v)),
    });
    return { ...state, variableSet: newSet };
  }

  if (setVariablesAction.match(action)) {
    const { variables } = action.payload;
    const newSet = new SceneVariableSet({ variables });
    return { ...state, variableSet: newSet };
  }

  return state;
};
