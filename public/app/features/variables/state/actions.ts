import { castArray, isEqual } from 'lodash';

import {
  DataQuery,
  getDataSourceRef,
  isDataSourceRef,
  isEmptyObject,
  isObject,
  LoadingState,
  TimeRange,
  TypedVariableModel,
  UrlQueryMap,
  UrlQueryValue,
  OrgVariableModel,
  QueryVariableModel,
  DashboardVariableModel,
  UserVariableModel,
  VariableHide,
  VariableOption,
  VariableRefresh,
  VariableWithOptions,
} from '@grafana/data';
import { config, locationService, logWarning } from '@grafana/runtime';
import { notifyApp } from 'app/core/actions';
import { contextSrv } from 'app/core/services/context_srv';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { store } from 'app/store/store';

import { createErrorNotification } from '../../../core/copy/appNotification';
import { appEvents } from '../../../core/core';
import { getBackendSrv } from '../../../core/services/backend_srv';
import { Graph, Node } from '../../../core/utils/dag';
import { AppNotification, StoreState, ThunkResult } from '../../../types';
import { getDatasourceSrv } from '../../plugins/datasource_srv';
import { getTemplateSrv, TemplateSrv } from '../../templating/template_srv';
import { variableAdapters } from '../adapters';
import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE, VARIABLE_PREFIX } from '../constants';
import { cleanEditorState } from '../editor/reducer';
import { hasCurrent, hasLegacyVariableSupport, hasOptions, hasStandardVariableSupport, isMulti } from '../guard';
import { getAllAffectedPanelIdsForVariableChange, getPanelVars } from '../inspect/utils';
import { cleanPickerState } from '../pickers/OptionsPicker/reducer';
import { alignCurrentWithMulti } from '../shared/multiOptions';
import {
  initialVariableModelState,
  TransactionStatus,
  VariablesChanged,
  VariablesChangedEvent,
  VariablesChangedInUrl,
  VariablesTimeRangeProcessDone,
} from '../types';
import {
  ensureStringValues,
  ExtendedUrlQueryMap,
  getCurrentText,
  getCurrentValue,
  getVariableRefresh,
  hasOngoingTransaction,
  toKeyedVariableIdentifier,
  toStateKey,
  toVariablePayload,
} from '../utils';

import { findVariableNodeInList, isVariableOnTimeRangeConfigured } from './helpers';
import { toKeyedAction } from './keyedVariablesReducer';
import { getIfExistsLastKey, getVariable, getVariablesByKey, getVariablesState } from './selectors';
import {
  addVariable,
  changeVariableProp,
  setCurrentVariableValue,
  variableStateCompleted,
  variableStateFailed,
  variableStateFetching,
  variableStateNotStarted,
} from './sharedReducer';
import {
  variablesClearTransaction,
  variablesCompleteTransaction,
  variablesInitTransaction,
} from './transactionReducer';
import { KeyedVariableIdentifier } from './types';
import { cleanVariables } from './variablesReducer';

// process flow queryVariable
// thunk => processVariables
//    adapter => setValueFromUrl
//      thunk => setOptionFromUrl
//        adapter => updateOptions
//          thunk => updateQueryVariableOptions
//            action => updateVariableOptions
//            action => updateVariableTags
//            thunk => validateVariableSelectionState
//              adapter => setValue
//                thunk => setOptionAsCurrent
//                  action => setCurrentVariableValue
//                  thunk => variableUpdated
//                    adapter => updateOptions for dependent nodes
//        adapter => setValue
//          thunk => setOptionAsCurrent
//            action => setCurrentVariableValue
//            thunk => variableUpdated
//              adapter => updateOptions for dependent nodes
//    adapter => updateOptions
//      thunk => updateQueryVariableOptions
//        action => updateVariableOptions
//        action => updateVariableTags
//        thunk => validateVariableSelectionState
//          adapter => setValue
//            thunk => setOptionAsCurrent
//              action => setCurrentVariableValue
//              thunk => variableUpdated
//                adapter => updateOptions for dependent nodes

export const initDashboardTemplating = (key: string, dashboard: DashboardModel): ThunkResult<void> => {
  return (dispatch, getState) => {
    let orderIndex = 0;
    const list = dashboard.templating.list;
    for (let index = 0; index < list.length; index++) {
      const model = fixSelectedInconsistency(list[index]);
      model.rootStateKey = key;
      if (!variableAdapters.getIfExists(model.type)) {
        continue;
      }

      dispatch(
        toKeyedAction(key, addVariable(toVariablePayload(model, { global: false, index: orderIndex++, model })))
      );
    }

    getTemplateSrv().updateTimeRange(getTimeSrv().timeRange());

    const variables = getVariablesByKey(key, getState());
    for (const variable of variables) {
      dispatch(toKeyedAction(key, variableStateNotStarted(toVariablePayload(variable))));
    }
  };
};

export function fixSelectedInconsistency(model: TypedVariableModel): TypedVariableModel | VariableWithOptions {
  if (!hasOptions(model)) {
    return model;
  }

  let found = false;
  for (const option of model.options) {
    option.selected = false;
    if (Array.isArray(model.current.value)) {
      for (const value of model.current.value) {
        if (option.value === value) {
          option.selected = found = true;
        }
      }
    } else if (option.value === model.current.value) {
      option.selected = found = true;
    }
  }

  if (!found && model.options.length) {
    model.options[0].selected = true;
  }

  return model;
}

export const addSystemTemplateVariables = (key: string, dashboard: DashboardModel): ThunkResult<void> => {
  return (dispatch) => {
    const dashboardModel: DashboardVariableModel = {
      ...initialVariableModelState,
      id: '__dashboard',
      name: '__dashboard',
      type: 'system',
      index: -3,
      skipUrlSync: true,
      hide: VariableHide.hideVariable,
      current: {
        value: {
          name: dashboard.title,
          uid: dashboard.uid,
          toString: () => dashboard.title,
        },
      },
    };

    dispatch(
      toKeyedAction(
        key,
        addVariable(
          toVariablePayload(dashboardModel, {
            global: dashboardModel.global,
            index: dashboardModel.index,
            model: dashboardModel,
          })
        )
      )
    );

    const orgModel: OrgVariableModel = {
      ...initialVariableModelState,
      id: '__org',
      name: '__org',
      type: 'system',
      index: -2,
      skipUrlSync: true,
      hide: VariableHide.hideVariable,
      current: {
        value: {
          name: contextSrv.user.orgName,
          id: contextSrv.user.orgId,
          toString: () => contextSrv.user.orgId.toString(),
        },
      },
    };

    dispatch(
      toKeyedAction(
        key,
        addVariable(toVariablePayload(orgModel, { global: orgModel.global, index: orgModel.index, model: orgModel }))
      )
    );

    const userModel: UserVariableModel = {
      ...initialVariableModelState,
      id: '__user',
      name: '__user',
      type: 'system',
      index: -1,
      skipUrlSync: true,
      hide: VariableHide.hideVariable,
      current: {
        value: {
          login: contextSrv.user.login,
          id: contextSrv.user.id,
          email: contextSrv.user.email,
          toString: () => contextSrv.user.id.toString(),
        },
      },
    };

    dispatch(
      toKeyedAction(
        key,
        addVariable(
          toVariablePayload(userModel, { global: userModel.global, index: userModel.index, model: userModel })
        )
      )
    );
  };
};

export const changeVariableMultiValue = (identifier: KeyedVariableIdentifier, multi: boolean): ThunkResult<void> => {
  return (dispatch, getState) => {
    const { rootStateKey: key } = identifier;
    const variable = getVariable(identifier, getState());
    if (!isMulti(variable) || isEmptyObject(variable.current)) {
      return;
    }

    const current = alignCurrentWithMulti(variable.current, multi);

    dispatch(
      toKeyedAction(key, changeVariableProp(toVariablePayload(identifier, { propName: 'multi', propValue: multi })))
    );
    dispatch(
      toKeyedAction(key, changeVariableProp(toVariablePayload(identifier, { propName: 'current', propValue: current })))
    );
  };
};

export const processVariableDependencies = async (variable: TypedVariableModel, state: StoreState) => {
  if (!variable.rootStateKey) {
    throw new Error(`rootStateKey not found for variable with id:${variable.id}`);
  }

  if (isDependencyGraphCircular(variable, state)) {
    throw new Error('Circular dependency in dashboard variables detected. Dashboard may not work as expected.');
  }

  const dependencies = getDirectDependencies(variable, state);

  if (!isWaitingForDependencies(variable.rootStateKey, dependencies, state)) {
    return;
  }

  await new Promise<void>((resolve) => {
    const unsubscribe = store.subscribe(() => {
      if (!variable.rootStateKey) {
        throw new Error(`rootStateKey not found for variable with id:${variable.id}`);
      }

      if (!isWaitingForDependencies(variable.rootStateKey, dependencies, store.getState())) {
        unsubscribe();
        resolve();
      }
    });
  });
};

const isDependencyGraphCircular = (
  variable: TypedVariableModel,
  state: StoreState,
  encounteredDependencyIds: Set<string> = new Set()
): boolean => {
  if (encounteredDependencyIds.has(variable.id)) {
    return true;
  }

  encounteredDependencyIds = new Set([...encounteredDependencyIds, variable.id]);

  return getDirectDependencies(variable, state).some((dependency) => {
    return isDependencyGraphCircular(dependency, state, encounteredDependencyIds);
  });
};

const getDirectDependencies = (variable: TypedVariableModel, state: StoreState) => {
  if (!variable.rootStateKey) {
    return [];
  }

  const directDependencies: TypedVariableModel[] = [];

  for (const otherVariable of getVariablesByKey(variable.rootStateKey, state)) {
    if (variable === otherVariable) {
      continue;
    }

    if (variableAdapters.getIfExists(variable.type)) {
      if (variableAdapters.get(variable.type).dependsOn(variable, otherVariable)) {
        directDependencies.push(otherVariable);
      }
    }
  }

  return directDependencies;
};

const isWaitingForDependencies = (key: string, dependencies: TypedVariableModel[], state: StoreState): boolean => {
  if (dependencies.length === 0) {
    return false;
  }

  const variables = getVariablesByKey(key, state);
  const notCompletedDependencies = dependencies.filter((d) =>
    variables.some((v) => v.id === d.id && (v.state === LoadingState.NotStarted || v.state === LoadingState.Loading))
  );

  return notCompletedDependencies.length > 0;
};

export const processVariable = (
  identifier: KeyedVariableIdentifier,
  queryParams: UrlQueryMap
): ThunkResult<Promise<void>> => {
  return async (dispatch, getState) => {
    const variable = getVariable(identifier, getState());
    await processVariableDependencies(variable, getState());

    const urlValue = queryParams[VARIABLE_PREFIX + variable.name];
    if (urlValue !== void 0) {
      const stringUrlValue = ensureStringValues(urlValue);
      await variableAdapters.get(variable.type).setValueFromUrl(variable, stringUrlValue);
      return;
    }

    if (variable.hasOwnProperty('refresh')) {
      const refreshableVariable = variable as QueryVariableModel;
      if (
        refreshableVariable.refresh === VariableRefresh.onDashboardLoad ||
        refreshableVariable.refresh === VariableRefresh.onTimeRangeChanged
      ) {
        await dispatch(updateOptions(toKeyedVariableIdentifier(refreshableVariable)));
        return;
      }
    }

    if (variable.type === 'custom') {
      await dispatch(updateOptions(toKeyedVariableIdentifier(variable)));
      return;
    }

    // for variables that aren't updated via URL or refresh, let's simulate the same state changes
    dispatch(completeVariableLoading(identifier));
  };
};

export const processVariables = (key: string): ThunkResult<Promise<void>> => {
  return async (dispatch, getState) => {
    const queryParams = locationService.getSearchObject();
    const promises = getVariablesByKey(key, getState()).map(
      async (variable) => await dispatch(processVariable(toKeyedVariableIdentifier(variable), queryParams))
    );

    await Promise.all(promises);
  };
};

export const setOptionFromUrl = (
  identifier: KeyedVariableIdentifier,
  urlValue: UrlQueryValue
): ThunkResult<Promise<void>> => {
  return async (dispatch, getState) => {
    const stringUrlValue = ensureStringValues(urlValue);
    const variable = getVariable(identifier, getState());
    if (getVariableRefresh(variable) !== VariableRefresh.never) {
      // updates options
      await dispatch(updateOptions(toKeyedVariableIdentifier(variable)));
    }

    // get variable from state
    const variableFromState = getVariable(toKeyedVariableIdentifier(variable), getState());
    if (!hasOptions(variableFromState)) {
      return;
    }

    if (!variableFromState) {
      throw new Error(`Couldn't find variable with name: ${variable.name}`);
    }
    // Simple case. Value in URL matches existing options text or value.
    let option = variableFromState.options.find((op) => {
      return op.text === stringUrlValue || op.value === stringUrlValue;
    });

    if (!option && isMulti(variableFromState)) {
      if (variableFromState.allValue && stringUrlValue === variableFromState.allValue) {
        option = { text: ALL_VARIABLE_TEXT, value: ALL_VARIABLE_VALUE, selected: false };
      }
    }

    if (!option) {
      let defaultText = stringUrlValue;
      const defaultValue = stringUrlValue;

      if (Array.isArray(stringUrlValue)) {
        // Multiple values in the url. We construct text as a list of texts from all matched options.
        defaultText = stringUrlValue.reduce((acc: string[], item: string) => {
          const foundOption = variableFromState.options.find((o) => o.value === item);
          if (!foundOption) {
            // @ts-ignore according to strict null errors this can never happen
            // TODO: investigate this further or refactor code
            return [].concat(acc, [item]);
          }

          // @ts-ignore according to strict null errors this can never happen
          // TODO: investigate this further or refactor code
          return [].concat(acc, [foundOption.text]);
        }, []);
      }

      // It is possible that we did not match the value to any existing option. In that case the URL value will be
      // used anyway for both text and value.
      option = { text: defaultText, value: defaultValue, selected: false };
    }

    if (isMulti(variableFromState)) {
      // In case variable is multiple choice, we cast to array to preserve the same behavior as when selecting
      // the option directly, which will return even single value in an array.
      option = alignCurrentWithMulti(
        { text: castArray(option.text), value: castArray(option.value), selected: false },
        variableFromState.multi
      );
    }

    await variableAdapters.get(variable.type).setValue(variableFromState, option);
  };
};

export const selectOptionsForCurrentValue = (variable: VariableWithOptions): VariableOption[] => {
  let i, y, value, option;
  const selected: VariableOption[] = [];

  for (i = 0; i < variable.options.length; i++) {
    option = { ...variable.options[i] };
    option.selected = false;
    if (Array.isArray(variable.current.value)) {
      for (y = 0; y < variable.current.value.length; y++) {
        value = variable.current.value[y];
        if (option.value === value) {
          option.selected = true;
          selected.push(option);
        }
      }
    } else if (option.value === variable.current.value) {
      option.selected = true;
      selected.push(option);
    }
  }

  return selected;
};

export const validateVariableSelectionState = (
  identifier: KeyedVariableIdentifier,
  defaultValue?: string
): ThunkResult<Promise<void>> => {
  return (dispatch, getState) => {
    const variableInState = getVariable(identifier, getState());
    if (!hasOptions(variableInState)) {
      return Promise.resolve();
    }

    const current = variableInState.current || ({} as unknown as VariableOption);
    const setValue = variableAdapters.get(variableInState.type).setValue;

    if (Array.isArray(current.value)) {
      const selected = selectOptionsForCurrentValue(variableInState);

      // if none pick first
      if (selected.length === 0) {
        const option = variableInState.options[0];
        return setValue(variableInState, {
          value: typeof option.value === 'string' ? [option.value] : option.value,
          text: typeof option.text === 'string' ? [option.text] : option.text,
          selected: true,
        });
      }

      const option: VariableOption = {
        value: selected.map((v) => v.value) as string[],
        text: selected.map((v) => v.text) as string[],
        selected: true,
      };
      return setValue(variableInState, option);
    }

    let option: VariableOption | undefined | null = null;

    // 1. find the current value
    const text = getCurrentText(variableInState);
    const value = getCurrentValue(variableInState);

    option = variableInState.options?.find((v: VariableOption) => v.text === text || v.value === value);
    if (option) {
      return setValue(variableInState, option);
    }

    // 2. find the default value
    if (defaultValue) {
      option = variableInState.options?.find((v) => v.text === defaultValue || v.value === defaultValue);
      if (option) {
        return setValue(variableInState, option);
      }
    }

    // 3. use the first value
    if (variableInState.options) {
      const option = variableInState.options[0];
      if (option) {
        return setValue(variableInState, option);
      }
    }

    // 4... give up
    return Promise.resolve();
  };
};

export const setOptionAsCurrent = (
  identifier: KeyedVariableIdentifier,
  current: VariableOption,
  emitChanges: boolean
): ThunkResult<Promise<void>> => {
  return async (dispatch) => {
    const { rootStateKey: key } = identifier;
    dispatch(toKeyedAction(key, setCurrentVariableValue(toVariablePayload(identifier, { option: current }))));
    return await dispatch(variableUpdated(identifier, emitChanges));
  };
};

export const createGraph = (variables: TypedVariableModel[]) => {
  const g = new Graph();

  variables.forEach((v) => {
    g.createNode(v.name);
  });

  variables.forEach((v1) => {
    variables.forEach((v2) => {
      if (v1 === v2) {
        return;
      }

      if (variableAdapters.get(v1.type).dependsOn(v1, v2)) {
        try {
          // link might fail if it would create a circular dependency
          g.link(v1.name, v2.name);
        } catch (error) {
          // Catch the exception and return partially linked graph. The caller will handle the case of partial linking and display errors
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          logWarning('Error linking variables', { error: errorMessage });
        }
      }
    });
  });

  return g;
};

export const variableUpdated = (
  identifier: KeyedVariableIdentifier,
  emitChangeEvents: boolean,
  events: typeof appEvents = appEvents
): ThunkResult<Promise<void>> => {
  return async (dispatch, getState) => {
    const state = getState();
    const { rootStateKey } = identifier;
    const variableInState = getVariable(identifier, state);

    // if we're initializing variables ignore cascading update because we are in a boot up scenario
    if (getVariablesState(rootStateKey, state).transaction.status === TransactionStatus.Fetching) {
      if (getVariableRefresh(variableInState) === VariableRefresh.never) {
        // for variable types with updates that go the setValueFromUrl path in the update let's make sure their state is set to Done.
        await dispatch(upgradeLegacyQueries(toKeyedVariableIdentifier(variableInState)));
        dispatch(completeVariableLoading(identifier));
      }
      return Promise.resolve();
    }

    const variables = getVariablesByKey(rootStateKey, state);
    const g = createGraph(variables);
    const panels = state.dashboard?.getModel()?.panels ?? [];
    const panelVars = getPanelVars(panels);

    const event: VariablesChangedEvent =
      variableInState.type === 'adhoc'
        ? { refreshAll: true, panelIds: [] } // for adhoc variables we don't know which panels that will be impacted
        : {
            refreshAll: false,
            panelIds: Array.from(getAllAffectedPanelIdsForVariableChange([variableInState.id], g, panelVars)),
            variable: getVariable(identifier, state),
          };

    const node = g.getNode(variableInState.name);
    let promises: Array<Promise<void>> = [];
    if (node) {
      promises = node.getOptimizedInputEdges().map((e) => {
        const variable = variables.find((v) => v.name === e.inputNode?.name);
        if (!variable) {
          return Promise.resolve();
        }

        return dispatch(updateOptions(toKeyedVariableIdentifier(variable)));
      });
    }

    return Promise.all(promises).then(() => {
      if (emitChangeEvents) {
        events.publish(new VariablesChanged(event));
        locationService.partial(getQueryWithVariables(rootStateKey, getState));
      }
    });
  };
};

export interface OnTimeRangeUpdatedDependencies {
  templateSrv: TemplateSrv;
  events: typeof appEvents;
}

const dfs = (
  node: Node,
  visited: string[],
  variables: TypedVariableModel[],
  variablesRefreshTimeRange: TypedVariableModel[]
) => {
  if (!visited.includes(node.name)) {
    visited.push(node.name);
  }
  node.outputEdges.forEach((e) => {
    const child = e.outputNode;
    if (child && !visited.includes(child.name)) {
      const childVariable = variables.find((v) => v.name === child.name) as QueryVariableModel;
      // when a variable is refreshed on time range change, we need to add that variable to be refreshed and mark its children as visited
      if (
        childVariable &&
        childVariable.refresh === VariableRefresh.onTimeRangeChanged &&
        variablesRefreshTimeRange.indexOf(childVariable) === -1
      ) {
        variablesRefreshTimeRange.push(childVariable);
        visited.push(child.name);
      } else {
        dfs(child, visited, variables, variablesRefreshTimeRange);
      }
    }
  });
  return variablesRefreshTimeRange;
};

// verify if the output edges of a node are not time range dependent
const areOuputEdgesNotTimeRange = (node: Node, variables: TypedVariableModel[]) => {
  return node.outputEdges.every((e) => {
    const childNode = e.outputNode;
    if (childNode) {
      const childVariable = findVariableNodeInList(variables, childNode.name);
      if (childVariable && childVariable.type === 'query') {
        return childVariable.refresh !== VariableRefresh.onTimeRangeChanged;
      }
    }
    return true;
  });
};

/**
 * This function returns a list of variables that need to be refreshed when the time range changes
 * It follows this logic
 * Create a graph based on all template variables.
 * Loop through all the variables and perform the following checks for each variable:
 *
 * -- a) If a variable A is a query variable, it’s time range, and has no dependent nodes
 * ----- it should be added to the variablesRefreshTimeRange.
 *
 * -- b) If a variable A is a query variable, it’s time range, and has dependent nodes (B, C)
 * ----- 1. add the variable A to variablesRefreshTimeRange
 * ----- 2. skip all the dependent nodes (B, C).
 *       Here, we should traverse the tree using DFS (Depth First Search), as the dependent nodes will be updated in cascade when the parent variable is updated.
 */

export const getVariablesThatNeedRefreshNew = (key: string, state: StoreState): TypedVariableModel[] => {
  const allVariables = getVariablesByKey(key, state);

  //create dependency graph
  const g = createGraph(allVariables);
  // create a list of nodes that were visited
  const visitedDfs: string[] = [];
  const variablesRefreshTimeRange: TypedVariableModel[] = [];
  allVariables.forEach((v) => {
    const node = g.getNode(v.name);
    if (visitedDfs.includes(v.name)) {
      return;
    }
    if (node) {
      const parentVariableNode = findVariableNodeInList(allVariables, node.name);
      if (!parentVariableNode) {
        return;
      }
      const isVariableTimeRange = isVariableOnTimeRangeConfigured(parentVariableNode);
      // if variable is time range and has no output edges add it to the list of variables that need refresh
      if (isVariableTimeRange && node.outputEdges.length === 0) {
        variablesRefreshTimeRange.push(parentVariableNode);
      }

      // if variable is time range and other variables depend on it (output edges) add it to the list of variables that need refresh and dont visit its dependents
      if (
        isVariableTimeRange &&
        variablesRefreshTimeRange.includes(parentVariableNode) &&
        node.outputEdges.length > 0
      ) {
        variablesRefreshTimeRange.push(parentVariableNode);
        dfs(node, visitedDfs, allVariables, variablesRefreshTimeRange);
      }

      // If is variable time range, has outputEdges, but the output edges are not time range configured, it means this
      // is the top variable that need to be refreshed
      if (isVariableTimeRange && node.outputEdges.length > 0 && areOuputEdgesNotTimeRange(node, allVariables)) {
        if (!variablesRefreshTimeRange.includes(parentVariableNode)) {
          variablesRefreshTimeRange.push(parentVariableNode);
        }
      }

      // if variable is not time range but has dependents (output edges) visit its dependants and repeat the process
      if (!isVariableTimeRange && node.outputEdges.length > 0) {
        dfs(node, visitedDfs, allVariables, variablesRefreshTimeRange);
      }
    }
  });

  return variablesRefreshTimeRange;
};

// old approach of refreshing variables that need refresh
const getVariablesThatNeedRefreshOld = (key: string, state: StoreState): VariableWithOptions[] => {
  const allVariables = getVariablesByKey(key, state);

  const variablesThatNeedRefresh = allVariables.filter((variable) => {
    if ('refresh' in variable && 'options' in variable) {
      const variableWithRefresh = variable;
      return variableWithRefresh.refresh === VariableRefresh.onTimeRangeChanged;
    }
    return false;
  }) as VariableWithOptions[];

  return variablesThatNeedRefresh;
};

export const onTimeRangeUpdated =
  (
    key: string,
    timeRange: TimeRange,
    dependencies: OnTimeRangeUpdatedDependencies = { templateSrv: getTemplateSrv(), events: appEvents }
  ): ThunkResult<Promise<void>> =>
  async (dispatch, getState) => {
    dependencies.templateSrv.updateTimeRange(timeRange);

    // approach # 2, get variables that need refresh but use the dependency graph to only update the ones that are affected
    // TODO: remove the VariableWithOptions type once the feature flag is on GA
    let variablesThatNeedRefresh: VariableWithOptions[] | TypedVariableModel[] = [];
    if (config.featureToggles.refactorVariablesTimeRange) {
      variablesThatNeedRefresh = getVariablesThatNeedRefreshNew(key, getState());
    } else {
      variablesThatNeedRefresh = getVariablesThatNeedRefreshOld(key, getState());
    }

    const variableIds = variablesThatNeedRefresh.map((variable) => variable.id);
    const promises = variablesThatNeedRefresh.map((variable) =>
      dispatch(timeRangeUpdated(toKeyedVariableIdentifier(variable)))
    );

    try {
      await Promise.all(promises);
      dependencies.events.publish(new VariablesTimeRangeProcessDone({ variableIds }));
    } catch (error) {
      console.error(error);
      dispatch(notifyApp(createVariableErrorNotification('Template variable service failed', error)));
    }
  };

export const timeRangeUpdated =
  (identifier: KeyedVariableIdentifier): ThunkResult<Promise<void>> =>
  async (dispatch, getState) => {
    const variableInState = getVariable(identifier, getState());
    if (!hasOptions(variableInState)) {
      return;
    }

    const previousOptions = variableInState.options.slice();

    await dispatch(updateOptions(toKeyedVariableIdentifier(variableInState), true));

    const updatedVariable = getVariable(identifier, getState());
    if (!hasOptions(updatedVariable)) {
      return;
    }

    const updatedOptions = updatedVariable.options;

    if (JSON.stringify(previousOptions) !== JSON.stringify(updatedOptions)) {
      const dashboard = getState().dashboard.getModel();
      dashboard?.templateVariableValueUpdated();
    }
  };

export const templateVarsChangedInUrl =
  (key: string, vars: ExtendedUrlQueryMap, events: typeof appEvents = appEvents): ThunkResult<void> =>
  async (dispatch, getState) => {
    const update: Array<Promise<void>> = [];
    const dashboard = getState().dashboard.getModel();
    const variables = getVariablesByKey(key, getState());

    for (const variable of variables) {
      const key = VARIABLE_PREFIX + variable.name;
      if (!vars.hasOwnProperty(key)) {
        // key not found quick exit
        continue;
      }

      if (!isVariableUrlValueDifferentFromCurrent(variable, vars[key].value)) {
        // variable values doesn't differ quick exit
        continue;
      }

      let value = vars[key].value; // as the default the value is set to the value passed into templateVarsChangedInUrl
      if (vars[key].removed) {
        // for some reason (panel|data link without variable) the variable url value (var-xyz) has been removed from the url
        // so we need to revert the value to the value stored in dashboard json
        const variableInModel = dashboard?.templating.list.find((v) => v.name === variable.name);
        if (variableInModel && hasCurrent(variableInModel)) {
          value = variableInModel.current.value; // revert value to the value stored in dashboard json
        }

        if (variableInModel && variableInModel.type === 'constant') {
          value = variableInModel.query; // revert value to the value stored in dashboard json, constants don't store current values in dashboard json
        }
      }

      const promise = variableAdapters.get(variable.type).setValueFromUrl(variable, value);
      update.push(promise);
    }

    const filteredVars = variables.filter((v) => {
      const key = VARIABLE_PREFIX + v.name;
      return (
        vars.hasOwnProperty(key) && isVariableUrlValueDifferentFromCurrent(v, vars[key].value) && v.type !== 'adhoc'
      );
    });
    const varGraph = createGraph(variables);
    const panelVars = getPanelVars(dashboard?.panels ?? []);
    const affectedPanels = getAllAffectedPanelIdsForVariableChange(
      filteredVars.map((v) => v.id),
      varGraph,
      panelVars
    );

    if (update.length) {
      await Promise.all(update);

      events.publish(
        new VariablesChangedInUrl({
          refreshAll: affectedPanels.size === 0,
          panelIds: Array.from(affectedPanels),
        })
      );
    }
  };

export function isVariableUrlValueDifferentFromCurrent(variable: TypedVariableModel, urlValue: unknown): boolean {
  const variableValue = variableAdapters.get(variable.type).getValueForUrl(variable);
  let stringUrlValue = ensureStringValues(urlValue);
  if (Array.isArray(variableValue) && !Array.isArray(stringUrlValue)) {
    stringUrlValue = [stringUrlValue];
  }
  // lodash isEqual handles array of value equality checks as well
  return !isEqual(variableValue, stringUrlValue);
}

const getQueryWithVariables = (key: string, getState: () => StoreState): UrlQueryMap => {
  const queryParams = locationService.getSearchObject();

  const queryParamsNew = Object.keys(queryParams)
    .filter((key) => key.indexOf(VARIABLE_PREFIX) === -1)
    .reduce<UrlQueryMap>((obj, key) => {
      obj[key] = queryParams[key];
      return obj;
    }, {});

  for (const variable of getVariablesByKey(key, getState())) {
    if (variable.skipUrlSync) {
      continue;
    }

    const adapter = variableAdapters.get(variable.type);
    queryParamsNew[VARIABLE_PREFIX + variable.name] = adapter.getValueForUrl(variable);
  }

  return queryParamsNew;
};

export const initVariablesTransaction =
  (urlUid: string, dashboard: DashboardModel): ThunkResult<Promise<void>> =>
  async (dispatch, getState) => {
    try {
      const uid = toStateKey(urlUid);
      const state = getState();
      const lastKey = getIfExistsLastKey(state);
      if (lastKey) {
        const transactionState = getVariablesState(lastKey, state).transaction;
        if (transactionState.status === TransactionStatus.Fetching) {
          // previous dashboard is still fetching variables, cancel all requests
          dispatch(cancelVariables(lastKey));
        }
      }

      // Start init transaction
      dispatch(toKeyedAction(uid, variablesInitTransaction({ uid })));
      // Add system variables like __dashboard and __user
      dispatch(addSystemTemplateVariables(uid, dashboard));
      // Load all variables into redux store
      dispatch(initDashboardTemplating(uid, dashboard));
      // Migrate data source name to ref
      dispatch(migrateVariablesDatasourceNameToRef(uid));
      // Process all variable updates
      await dispatch(processVariables(uid));
      // Set transaction as complete
      dispatch(toKeyedAction(uid, variablesCompleteTransaction({ uid })));
    } catch (err) {
      dispatch(notifyApp(createVariableErrorNotification('Templating init failed', err)));
      console.error(err);
    }
  };

export function migrateVariablesDatasourceNameToRef(
  key: string,
  getDatasourceSrvFunc = getDatasourceSrv
): ThunkResult<void> {
  return (dispatch, getState) => {
    const variables = getVariablesByKey(key, getState());
    for (const variable of variables) {
      if (variable.type !== 'adhoc' && variable.type !== 'query') {
        continue;
      }

      const { datasource: nameOrRef } = variable;

      if (isDataSourceRef(nameOrRef)) {
        continue;
      }

      // the call to getInstanceSettings needs to be done after initDashboardTemplating because we might have
      // datasource variables that need to be resolved
      const ds = getDatasourceSrvFunc().getInstanceSettings(nameOrRef);
      const dsRef = ds ? getDataSourceRef(ds) : { uid: nameOrRef };
      dispatch(
        toKeyedAction(
          key,
          changeVariableProp(toVariablePayload(variable, { propName: 'datasource', propValue: dsRef }))
        )
      );
    }
  };
}

export const cleanUpVariables =
  (key: string): ThunkResult<void> =>
  (dispatch) => {
    dispatch(toKeyedAction(key, cleanVariables()));
    dispatch(toKeyedAction(key, cleanEditorState()));
    dispatch(toKeyedAction(key, cleanPickerState()));
    dispatch(toKeyedAction(key, variablesClearTransaction()));
  };

type CancelVariablesDependencies = { getBackendSrv: typeof getBackendSrv };
export const cancelVariables =
  (key: string, dependencies: CancelVariablesDependencies = { getBackendSrv: getBackendSrv }): ThunkResult<void> =>
  (dispatch) => {
    dependencies.getBackendSrv().cancelAllInFlightRequests();
    dispatch(cleanUpVariables(key));
  };

export const updateOptions =
  (identifier: KeyedVariableIdentifier, rethrow = false): ThunkResult<Promise<void>> =>
  async (dispatch, getState) => {
    const { rootStateKey } = identifier;
    try {
      if (!hasOngoingTransaction(rootStateKey, getState())) {
        // we might have cancelled a batch so then variable state is removed
        return;
      }

      const variableInState = getVariable(identifier, getState());
      dispatch(toKeyedAction(rootStateKey, variableStateFetching(toVariablePayload(variableInState))));
      await dispatch(upgradeLegacyQueries(toKeyedVariableIdentifier(variableInState)));
      await variableAdapters.get(variableInState.type).updateOptions(variableInState);
      dispatch(completeVariableLoading(identifier));
    } catch (error) {
      dispatch(toKeyedAction(rootStateKey, variableStateFailed(toVariablePayload(identifier, { error }))));

      if (!rethrow) {
        console.error(error);
        dispatch(notifyApp(createVariableErrorNotification('Error updating options:', error, identifier)));
      }

      if (rethrow) {
        throw error;
      }
    }
  };

export const createVariableErrorNotification = (
  message: string,
  error: unknown,
  identifier?: KeyedVariableIdentifier
): AppNotification =>
  createErrorNotification(
    `${identifier ? `Templating [${identifier.id}]` : 'Templating'}`,
    error instanceof Error ? `${message} ${error.message}` : `${message}`
  );

export const completeVariableLoading =
  (identifier: KeyedVariableIdentifier): ThunkResult<void> =>
  (dispatch, getState) => {
    const { rootStateKey } = identifier;
    if (!hasOngoingTransaction(rootStateKey, getState())) {
      // we might have cancelled a batch so then variable state is removed
      return;
    }

    const variableInState = getVariable(identifier, getState());

    if (variableInState.state !== LoadingState.Done) {
      dispatch(toKeyedAction(identifier.rootStateKey, variableStateCompleted(toVariablePayload(variableInState))));
    }
  };

export function upgradeLegacyQueries(
  identifier: KeyedVariableIdentifier,
  getDatasourceSrvFunc: typeof getDatasourceSrv = getDatasourceSrv
): ThunkResult<void> {
  return async function (dispatch, getState) {
    const { id, rootStateKey } = identifier;
    if (!hasOngoingTransaction(rootStateKey, getState())) {
      // we might have cancelled a batch so then variable state is removed
      return;
    }

    const variable = getVariable(identifier, getState());
    if (variable.type !== 'query') {
      return;
    }

    try {
      const datasource = await getDatasourceSrvFunc().get(variable.datasource ?? '');

      if (hasLegacyVariableSupport(datasource)) {
        return;
      }

      if (!hasStandardVariableSupport(datasource)) {
        return;
      }

      if (isDataQueryType(variable.query)) {
        return;
      }

      const query = {
        refId: `${datasource.name}-${id}-Variable-Query`,
        query: variable.query,
      };

      dispatch(
        toKeyedAction(
          rootStateKey,
          changeVariableProp(toVariablePayload(identifier, { propName: 'query', propValue: query }))
        )
      );
    } catch (err) {
      dispatch(notifyApp(createVariableErrorNotification('Failed to upgrade legacy queries', err)));
      console.error(err);
    }
  };
}

function isDataQueryType(query: unknown): query is DataQuery {
  return isObject(query) && 'refId' in query && typeof query.refId === 'string';
}
