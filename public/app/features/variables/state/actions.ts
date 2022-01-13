import angular from 'angular';
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

import {
  DashboardVariableModel,
  initialVariableModelState,
  OrgVariableModel,
  QueryVariableModel,
  UserVariableModel,
  VariableHide,
  VariableModel,
  VariableOption,
  VariableRefresh,
  VariablesChanged,
  VariablesChangedEvent,
  VariablesChangedInUrl,
  VariablesTimeRangeProcessDone,
  VariableWithMultiSupport,
  VariableWithOptions,
} from '../types';
import { AppNotification, StoreState, ThunkResult } from '../../../types';
import { getVariable, getVariables } from './selectors';
import { variableAdapters } from '../adapters';
import { Graph } from '../../../core/utils/dag';
import { notifyApp } from 'app/core/actions';
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
  ALL_VARIABLE_TEXT,
  ALL_VARIABLE_VALUE,
  toVariableIdentifier,
  toVariablePayload,
  VariableIdentifier,
} from './types';
import { contextSrv } from 'app/core/services/context_srv';
import { getTemplateSrv, TemplateSrv } from '../../templating/template_srv';
import { alignCurrentWithMulti } from '../shared/multiOptions';
import {
  hasCurrent,
  hasLegacyVariableSupport,
  hasOptions,
  hasStandardVariableSupport,
  isAdHoc,
  isMulti,
  isQuery,
} from '../guard';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { DashboardModel } from 'app/features/dashboard/state';
import { createErrorNotification } from '../../../core/copy/appNotification';
import {
  TransactionStatus,
  variablesClearTransaction,
  variablesCompleteTransaction,
  variablesInitTransaction,
} from './transactionReducer';
import { getBackendSrv } from '../../../core/services/backend_srv';
import { cleanVariables } from './variablesReducer';
import { ensureStringValues, ExtendedUrlQueryMap, getCurrentText, getVariableRefresh } from '../utils';
import { store } from 'app/store/store';
import { getDatasourceSrv } from '../../plugins/datasource_srv';
import { cleanEditorState } from '../editor/reducer';
import { cleanPickerState } from '../pickers/OptionsPicker/reducer';
import { locationService } from '@grafana/runtime';
import { appEvents } from '../../../core/core';
import { getAllAffectedPanelIdsForVariableChange } from '../inspect/utils';

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

export const initDashboardTemplating = (list: VariableModel[]): ThunkResult<void> => {
  return (dispatch, getState) => {
    let orderIndex = 0;
    for (let index = 0; index < list.length; index++) {
      const model = fixSelectedInconsistency(list[index]);
      if (!variableAdapters.getIfExists(model.type)) {
        continue;
      }

      dispatch(addVariable(toVariablePayload(model, { global: false, index: orderIndex++, model })));
    }

    getTemplateSrv().updateTimeRange(getTimeSrv().timeRange());

    const variables = getVariables(getState());
    for (let index = 0; index < variables.length; index++) {
      const variable = variables[index];
      dispatch(variableStateNotStarted(toVariablePayload(variable)));
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

export const addSystemTemplateVariables = (dashboard: DashboardModel): ThunkResult<void> => {
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
      addVariable(
        toVariablePayload(dashboardModel, {
          global: dashboardModel.global,
          index: dashboardModel.index,
          model: dashboardModel,
        })
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
      addVariable(toVariablePayload(orgModel, { global: orgModel.global, index: orgModel.index, model: orgModel }))
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
      addVariable(toVariablePayload(userModel, { global: userModel.global, index: userModel.index, model: userModel }))
    );
  };
};

export const changeVariableMultiValue = (identifier: VariableIdentifier, multi: boolean): ThunkResult<void> => {
  return (dispatch, getState) => {
    const variable = getVariable<VariableWithMultiSupport>(identifier.id, getState());
    const current = alignCurrentWithMulti(variable.current, multi);

    dispatch(changeVariableProp(toVariablePayload(identifier, { propName: 'multi', propValue: multi })));
    dispatch(changeVariableProp(toVariablePayload(identifier, { propName: 'current', propValue: current })));
  };
};

export const processVariableDependencies = async (variable: VariableModel, state: StoreState) => {
  const dependencies: VariableModel[] = [];

  for (const otherVariable of getVariables(state)) {
    if (variable === otherVariable) {
      continue;
    }

    if (variableAdapters.getIfExists(variable.type)) {
      if (variableAdapters.get(variable.type).dependsOn(variable, otherVariable)) {
        dependencies.push(otherVariable);
      }
    }
  }

  if (!isWaitingForDependencies(dependencies, state)) {
    return;
  }

  await new Promise<void>((resolve) => {
    const unsubscribe = store.subscribe(() => {
      if (!isWaitingForDependencies(dependencies, store.getState())) {
        unsubscribe();
        resolve();
      }
    });
  });
};

const isWaitingForDependencies = (dependencies: VariableModel[], state: StoreState): boolean => {
  if (dependencies.length === 0) {
    return false;
  }

  const variables = getVariables(state);
  const notCompletedDependencies = dependencies.filter((d) =>
    variables.some((v) => v.id === d.id && (v.state === LoadingState.NotStarted || v.state === LoadingState.Loading))
  );

  return notCompletedDependencies.length > 0;
};

export const processVariable = (
  identifier: VariableIdentifier,
  queryParams: UrlQueryMap
): ThunkResult<Promise<void>> => {
  return async (dispatch, getState) => {
    const variable = getVariable(identifier.id, getState());
    await processVariableDependencies(variable, getState());

    const urlValue = queryParams['var-' + variable.name];
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
        await dispatch(updateOptions(toVariableIdentifier(refreshableVariable)));
        return;
      }
    }

    // for variables that aren't updated via URL or refresh, let's simulate the same state changes
    dispatch(completeVariableLoading(identifier));
  };
};

export const processVariables = (): ThunkResult<Promise<void>> => {
  return async (dispatch, getState) => {
    const queryParams = locationService.getSearchObject();
    const promises = getVariables(getState()).map(
      async (variable: VariableModel) => await dispatch(processVariable(toVariableIdentifier(variable), queryParams))
    );

    await Promise.all(promises);
  };
};

export const setOptionFromUrl = (
  identifier: VariableIdentifier,
  urlValue: UrlQueryValue
): ThunkResult<Promise<void>> => {
  return async (dispatch, getState) => {
    const stringUrlValue = ensureStringValues(urlValue);
    const variable = getVariable(identifier.id, getState());
    if (getVariableRefresh(variable) !== VariableRefresh.never) {
      // updates options
      await dispatch(updateOptions(toVariableIdentifier(variable)));
    }

    // get variable from state
    const variableFromState = getVariable<VariableWithOptions>(variable.id, getState());
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
  identifier: VariableIdentifier,
  defaultValue?: string
): ThunkResult<Promise<void>> => {
  return (dispatch, getState) => {
    const variableInState = getVariable<VariableWithOptions>(identifier.id, getState());
    const current = variableInState.current || (({} as unknown) as VariableOption);
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
  identifier: VariableIdentifier,
  current: VariableOption,
  emitChanges: boolean
): ThunkResult<Promise<void>> => {
  return async (dispatch) => {
    dispatch(setCurrentVariableValue(toVariablePayload(identifier, { option: current })));
    return await dispatch(variableUpdated(identifier, emitChanges));
  };
};

const createGraph = (variables: VariableModel[]) => {
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
  identifier: VariableIdentifier,
  emitChangeEvents: boolean,
  events: typeof appEvents = appEvents
): ThunkResult<Promise<void>> => {
  return async (dispatch, getState) => {
    const state = getState();
    const variableInState = getVariable(identifier.id, state);

    // if we're initializing variables ignore cascading update because we are in a boot up scenario
    if (state.templating.transaction.status === TransactionStatus.Fetching) {
      if (getVariableRefresh(variableInState) === VariableRefresh.never) {
        // for variable types with updates that go the setValueFromUrl path in the update let's make sure their state is set to Done.
        await dispatch(upgradeLegacyQueries(toVariableIdentifier(variableInState)));
        dispatch(completeVariableLoading(identifier));
      }
      return Promise.resolve();
    }

    const variables = getVariables(state);
    const g = createGraph(variables);
    const panels = state.dashboard?.getModel()?.panels ?? [];
    const event: VariablesChangedEvent = isAdHoc(variableInState)
      ? { refreshAll: true, panelIds: [] } // for adhoc variables we don't know which panels that will be impacted
      : { refreshAll: false, panelIds: getAllAffectedPanelIdsForVariableChange(variableInState.id, variables, panels) };

    const node = g.getNode(variableInState.name);
    let promises: Array<Promise<any>> = [];
    if (node) {
      promises = node.getOptimizedInputEdges().map((e) => {
        const variable = variables.find((v) => v.name === e.inputNode?.name);
        if (!variable) {
          return Promise.resolve();
        }

        return dispatch(updateOptions(toVariableIdentifier(variable)));
      });
    }

    return Promise.all(promises).then(() => {
      if (emitChangeEvents) {
        events.publish(new VariablesChanged(event));
        locationService.partial(getQueryWithVariables(getState));
      }
    });
  };
};

export interface OnTimeRangeUpdatedDependencies {
  templateSrv: TemplateSrv;
  events: typeof appEvents;
}

export const onTimeRangeUpdated = (
  timeRange: TimeRange,
  dependencies: OnTimeRangeUpdatedDependencies = { templateSrv: getTemplateSrv(), events: appEvents }
): ThunkResult<Promise<void>> => async (dispatch, getState) => {
  dependencies.templateSrv.updateTimeRange(timeRange);
  const variablesThatNeedRefresh = getVariables(getState()).filter((variable) => {
    if (variable.hasOwnProperty('refresh') && variable.hasOwnProperty('options')) {
      const variableWithRefresh = (variable as unknown) as QueryVariableModel;
      return variableWithRefresh.refresh === VariableRefresh.onTimeRangeChanged;
    }

    return false;
  }) as VariableWithOptions[];

  const variableIds = variablesThatNeedRefresh.map((variable) => variable.id);
  const promises = variablesThatNeedRefresh.map((variable: VariableWithOptions) =>
    dispatch(timeRangeUpdated(toVariableIdentifier(variable)))
  );

  try {
    await Promise.all(promises);
    dependencies.events.publish(new VariablesTimeRangeProcessDone({ variableIds }));
  } catch (error) {
    console.error(error);
    dispatch(notifyApp(createVariableErrorNotification('Template variable service failed', error)));
  }
};

const timeRangeUpdated = (identifier: VariableIdentifier): ThunkResult<Promise<void>> => async (dispatch, getState) => {
  const variableInState = getVariable<VariableWithOptions>(identifier.id);
  const previousOptions = variableInState.options.slice();

  await dispatch(updateOptions(toVariableIdentifier(variableInState), true));

  const updatedVariable = getVariable<VariableWithOptions>(identifier.id, getState());
  const updatedOptions = updatedVariable.options;

  if (angular.toJson(previousOptions) !== angular.toJson(updatedOptions)) {
    const dashboard = getState().dashboard.getModel();
    dashboard?.templateVariableValueUpdated();
  }
};

export const templateVarsChangedInUrl = (
  vars: ExtendedUrlQueryMap,
  events: typeof appEvents = appEvents
): ThunkResult<void> => async (dispatch, getState) => {
  const update: Array<Promise<any>> = [];
  const dashboard = getState().dashboard.getModel();
  for (const variable of getVariables(getState())) {
    const key = `var-${variable.name}`;
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
    }

    const promise = variableAdapters.get(variable.type).setValueFromUrl(variable, value);
    update.push(promise);
  }

  if (update.length) {
    await Promise.all(update);
    events.publish(new VariablesChangedInUrl({ panelIds: [], refreshAll: true }));
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

const getQueryWithVariables = (getState: () => StoreState): UrlQueryMap => {
  const queryParams = locationService.getSearchObject();

  const queryParamsNew = Object.keys(queryParams)
    .filter((key) => key.indexOf('var-') === -1)
    .reduce((obj, key) => {
      obj[key] = queryParams[key];
      return obj;
    }, {} as UrlQueryMap);

  for (const variable of getVariables(getState())) {
    if (variable.skipUrlSync) {
      continue;
    }

    const adapter = variableAdapters.get(variable.type);
    queryParamsNew['var-' + variable.name] = adapter.getValueForUrl(variable);
  }

  return queryParamsNew;
};

export const initVariablesTransaction = (dashboardUid: string, dashboard: DashboardModel): ThunkResult<void> => async (
  dispatch,
  getState
) => {
  try {
    const transactionState = getState().templating.transaction;
    if (transactionState.status === TransactionStatus.Fetching) {
      // previous dashboard is still fetching variables, cancel all requests
      dispatch(cancelVariables());
    }

    // Start init transaction
    dispatch(variablesInitTransaction({ uid: dashboardUid }));
    // Add system variables like __dashboard and __user
    dispatch(addSystemTemplateVariables(dashboard));
    // Load all variables into redux store
    dispatch(initDashboardTemplating(dashboard.templating.list));
    // Migrate data source name to ref
    dispatch(migrateVariablesDatasourceNameToRef());
    // Process all variable updates
    await dispatch(processVariables());
    // Mark update as complete
    dispatch(variablesCompleteTransaction({ uid: dashboardUid }));
  } catch (err) {
    dispatch(notifyApp(createVariableErrorNotification('Templating init failed', err)));
    console.error(err);
  }
};

export function migrateVariablesDatasourceNameToRef(
  getDatasourceSrvFunc: typeof getDatasourceSrv = getDatasourceSrv
): ThunkResult<void> {
  return function (dispatch, getState) {
    const variables = getVariables(getState());
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
      const dsRef = !ds ? { uid: nameOrRef } : getDataSourceRef(ds);
      dispatch(changeVariableProp(toVariablePayload(variable, { propName: 'datasource', propValue: dsRef })));
    }
  };
}

export const cleanUpVariables = (): ThunkResult<void> => (dispatch) => {
  dispatch(cleanVariables());
  dispatch(cleanEditorState());
  dispatch(cleanPickerState());
  dispatch(variablesClearTransaction());
};

type CancelVariablesDependencies = { getBackendSrv: typeof getBackendSrv };
export const cancelVariables = (
  dependencies: CancelVariablesDependencies = { getBackendSrv: getBackendSrv }
): ThunkResult<void> => (dispatch) => {
  dependencies.getBackendSrv().cancelAllInFlightRequests();
  dispatch(cleanUpVariables());
};

export const updateOptions = (identifier: VariableIdentifier, rethrow = false): ThunkResult<Promise<void>> => async (
  dispatch,
  getState
) => {
  const variableInState = getVariable(identifier.id, getState());
  try {
    dispatch(variableStateFetching(toVariablePayload(variableInState)));
    await dispatch(upgradeLegacyQueries(toVariableIdentifier(variableInState)));
    await variableAdapters.get(variableInState.type).updateOptions(variableInState);
    dispatch(completeVariableLoading(identifier));
  } catch (error) {
    dispatch(variableStateFailed(toVariablePayload(variableInState, { error })));

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
  identifier?: VariableIdentifier
): AppNotification =>
  createErrorNotification(
    `${identifier ? `Templating [${identifier.id}]` : 'Templating'}`,
    `${message} ${error.message}`
  );

export const completeVariableLoading = (identifier: VariableIdentifier): ThunkResult<void> => (dispatch, getState) => {
  const variableInState = getVariable(identifier.id, getState());

  if (variableInState.state !== LoadingState.Done) {
    dispatch(variableStateCompleted(toVariablePayload(variableInState)));
  }
};

export function upgradeLegacyQueries(
  identifier: VariableIdentifier,
  getDatasourceSrvFunc: typeof getDatasourceSrv = getDatasourceSrv
): ThunkResult<void> {
  return async function (dispatch, getState) {
    const variable = getVariable<QueryVariableModel>(identifier.id, getState());

    if (!isQuery(variable)) {
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
        refId: `${datasource.name}-${identifier.id}-Variable-Query`,
        query: variable.query,
      };

      dispatch(changeVariableProp(toVariablePayload(identifier, { propName: 'query', propValue: query })));
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
