import { castArray, isEqual } from 'lodash';

import {
  DataQuery,
  getDataSourceRef,
  isDataSourceRef,
  LoadingState,
  TimeRange,
  UrlQueryMap,
  UrlQueryValue,
} from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { notifyApp } from 'app/core/actions';
import { contextSrv } from 'app/core/services/context_srv';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { DashboardModel } from 'app/features/dashboard/state';
import { store } from 'app/store/store';

import { createErrorNotification } from '../../../core/copy/appNotification';
import { appEvents } from '../../../core/core';
import { getBackendSrv } from '../../../core/services/backend_srv';
import { Graph } from '../../../core/utils/dag';
import { AppNotification, StoreState, ThunkResult } from '../../../types';
import { getDatasourceSrv } from '../../plugins/datasource_srv';
import { getTemplateSrv, TemplateSrv } from '../../templating/template_srv';
import { variableAdapters } from '../adapters';
import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE, VARIABLE_PREFIX } from '../constants';
import { cleanEditorState } from '../editor/reducer';
import {
  hasCurrent,
  hasLegacyVariableSupport,
  hasOptions,
  hasStandardVariableSupport,
  isAdHoc,
  isConstant,
  isMulti,
  isQuery,
} from '../guard';
import { getAllAffectedPanelIdsForVariableChange, getPanelVars } from '../inspect/utils';
import { cleanPickerState } from '../pickers/OptionsPicker/reducer';
import { alignCurrentWithMulti } from '../shared/multiOptions';
import {
  DashboardVariableModel,
  initialVariableModelState,
  OrgVariableModel,
  QueryVariableModel,
  TransactionStatus,
  UserVariableModel,
  VariableHide,
  VariableModel,
  VariableOption,
  VariableRefresh,
  VariablesChanged,
  VariablesChangedEvent,
  VariablesChangedInUrl,
  VariablesTimeRangeProcessDone,
  VariableWithOptions,
} from '../types';
import {
  ensureStringValues,
  ExtendedUrlQueryMap,
  getCurrentText,
  getVariableRefresh,
  hasOngoingTransaction,
  toKeyedVariableIdentifier,
  toStateKey,
  toVariablePayload,
} from '../utils';

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

export function fixSelectedInconsistency(model: VariableModel): VariableModel | VariableWithOptions {
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
    if (!isMulti(variable)) {
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

export const processVariableDependencies = async (variable: VariableModel, state: StoreState) => {
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
  variable: VariableModel,
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

const getDirectDependencies = (variable: VariableModel, state: StoreState) => {
  if (!variable.rootStateKey) {
    return [];
  }

  const directDependencies: VariableModel[] = [];

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

const isWaitingForDependencies = (key: string, dependencies: VariableModel[], state: StoreState): boolean => {
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

    // for variables that aren't updated via URL or refresh, let's simulate the same state changes
    dispatch(completeVariableLoading(identifier));
  };
};

export const processVariables = (key: string): ThunkResult<Promise<void>> => {
  return async (dispatch, getState) => {
    const queryParams = locationService.getSearchObject();
    const promises = getVariablesByKey(key, getState()).map(
      async (variable: VariableModel) =>
        await dispatch(processVariable(toKeyedVariableIdentifier(variable), queryParams))
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
        return setValue(variableInState, option);
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
    option = variableInState.options?.find((v) => v.text === text);
    if (option) {
      return setValue(variableInState, option);
    }

    // 2. find the default value
    if (defaultValue) {
      option = variableInState.options?.find((v) => v.text === defaultValue);
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

export const createGraph = (variables: VariableModel[]) => {
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
        g.link(v1.name, v2.name);
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

    const event: VariablesChangedEvent = isAdHoc(variableInState)
      ? { refreshAll: true, panelIds: [] } // for adhoc variables we don't know which panels that will be impacted
      : {
          refreshAll: false,
          panelIds: Array.from(getAllAffectedPanelIdsForVariableChange([variableInState.id], g, panelVars)),
        };

    const node = g.getNode(variableInState.name);
    let promises: Array<Promise<any>> = [];
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

export const onTimeRangeUpdated =
  (
    key: string,
    timeRange: TimeRange,
    dependencies: OnTimeRangeUpdatedDependencies = { templateSrv: getTemplateSrv(), events: appEvents }
  ): ThunkResult<Promise<void>> =>
  async (dispatch, getState) => {
    dependencies.templateSrv.updateTimeRange(timeRange);
    const variablesThatNeedRefresh = getVariablesByKey(key, getState()).filter((variable) => {
      if (variable.hasOwnProperty('refresh') && variable.hasOwnProperty('options')) {
        const variableWithRefresh = variable as unknown as QueryVariableModel;
        return variableWithRefresh.refresh === VariableRefresh.onTimeRangeChanged;
      }

      return false;
    }) as VariableWithOptions[];

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

const timeRangeUpdated =
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
    const update: Array<Promise<any>> = [];
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

        if (variableInModel && isConstant(variableInModel)) {
          value = variableInModel.query; // revert value to the value stored in dashboard json, constants don't store current values in dashboard json
        }
      }

      const promise = variableAdapters.get(variable.type).setValueFromUrl(variable, value);
      update.push(promise);
    }

    const filteredVars = variables.filter((v) => {
      const key = VARIABLE_PREFIX + v.name;
      return vars.hasOwnProperty(key) && isVariableUrlValueDifferentFromCurrent(v, vars[key].value) && !isAdHoc(v);
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

export function isVariableUrlValueDifferentFromCurrent(variable: VariableModel, urlValue: any): boolean {
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
    .reduce((obj, key) => {
      obj[key] = queryParams[key];
      return obj;
    }, {} as UrlQueryMap);

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
      if (!isAdHoc(variable) && !isQuery(variable)) {
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
  error: any,
  identifier?: KeyedVariableIdentifier
): AppNotification =>
  createErrorNotification(
    `${identifier ? `Templating [${identifier.id}]` : 'Templating'}`,
    `${message} ${error.message}`
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

function isDataQueryType(query: any): query is DataQuery {
  if (!query) {
    return false;
  }

  return query.hasOwnProperty('refId') && typeof query.refId === 'string';
}
