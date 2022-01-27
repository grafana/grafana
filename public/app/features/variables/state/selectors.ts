import { StoreState } from '../../../types';
import { VariableModel } from '../types';
import { getState } from '../../../store/store';
import memoizeOne from 'memoize-one';
import { getInitialTemplatingState, TemplatingState } from './reducers';
import { toStateKey } from '../utils';
import { DashboardVariableIdentifier, VariablesState } from './types';

export const getDashboardVariable = <T extends VariableModel = VariableModel>(
  identifier: DashboardVariableIdentifier,
  state: StoreState = getState(),
  throwWhenMissing = true
): T => {
  const { id, dashboardUid: uid } = identifier;
  const variablesState = getDashboardVariablesState(uid, state);
  if (!variablesState.variables[id]) {
    if (throwWhenMissing) {
      throw new Error(`Couldn't find variable with id:${id}`);
    }
    return (undefined as unknown) as T;
  }

  return variablesState.variables[id] as T;
};

function getFilteredDashboardVariables(
  filter: (model: VariableModel) => boolean,
  uid: string,
  state: StoreState = getState()
) {
  return Object.values(getDashboardVariablesState(uid, state).variables)
    .filter(filter)
    .sort((s1, s2) => s1.index - s2.index);
}

export function getDashboardVariablesState(uid: string, state: StoreState = getState()): TemplatingState {
  return state.dashboardVariables.slices[toStateKey(uid)] ?? getInitialTemplatingState();
}

export function getDashboardVariables(uid: string, state: StoreState = getState()): VariableModel[] {
  return getFilteredDashboardVariables(defaultVariablesFilter, uid, state);
}

export function defaultVariablesFilter(variable: VariableModel): boolean {
  return variable.type !== 'system';
}

export const getDashboardSubMenuVariables = memoizeOne(
  (uid: string, variables: Record<string, VariableModel>): VariableModel[] => {
    return getDashboardVariables(uid, getState());
  }
);

export const getDashboardEditorVariables = (uid: string, state: StoreState): VariableModel[] => {
  return getDashboardVariables(uid, state);
};

export type GetVariables = typeof getDashboardVariables;

export function getNewDashboardVariableIndex(uid: string, state: StoreState = getState()): number {
  return getNextVariableIndex(Object.values(getDashboardVariablesState(uid, state).variables));
}

export function getNextVariableIndex(variables: VariableModel[]): number {
  const sorted = variables.filter(defaultVariablesFilter).sort((v1, v2) => v1.index - v2.index);
  return sorted.length > 0 ? sorted[sorted.length - 1].index + 1 : 0;
}

export function getDashboardVariablesIsDirty(uid: string, state: StoreState = getState()): boolean {
  return getDashboardVariablesState(uid, state).transaction.isDirty;
}

export function getIfExistsLastUid(state: StoreState = getState()): string | undefined {
  return state.dashboardVariables?.lastUid;
}

export function getLastUid(state: StoreState = getState()): string {
  if (!state.dashboardVariables?.lastUid) {
    throw new Error('Accessing lastUid without initializing it variables');
  }

  return state.dashboardVariables.lastUid;
}

// selectors used by template srv, assumes that lastUid is in state. Needs to change when/if dashboard redux state becomes keyed too.
export function getFilteredVariables(filter: (model: VariableModel) => boolean, state: StoreState = getState()) {
  const lastUid = getIfExistsLastUid(state);
  if (!lastUid) {
    return [];
  }
  return getFilteredDashboardVariables(filter, lastUid, state);
}

export function getVariables(state: StoreState = getState()) {
  const lastUid = getIfExistsLastUid(state);
  if (!lastUid) {
    return [];
  }
  return getDashboardVariables(lastUid, state);
}

export function getVariableWithName(name: string, state: StoreState = getState()) {
  const lastUid = getIfExistsLastUid(state);
  if (!lastUid) {
    return;
  }
  return getDashboardVariable({ id: name, dashboardUid: lastUid, type: 'query' }, state, false);
}

export function getInstanceState<Model extends VariableModel = VariableModel>(state: VariablesState, id: string) {
  return state[id] as Model;
}
