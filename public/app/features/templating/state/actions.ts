import { MouseEvent } from 'react';
import { v4 } from 'uuid';
import { ActionCreatorWithPayload, createAction, PrepareAction } from '@reduxjs/toolkit';
import { UrlQueryValue } from '@grafana/runtime';

import {
  QueryVariableModel,
  VariableModel,
  VariableOption,
  VariableRefresh,
  VariableType,
  VariableWithOptions,
} from '../variable';
import { ThunkResult } from '../../../types';
import { getVariable, getVariables } from './selectors';
import { variableAdapters } from '../adapters';
import _ from 'lodash';
import { getDatasourceSrv } from '../../plugins/datasource_srv';
import { getTimeSrv } from '../../dashboard/services/TimeSrv';
import { Graph } from '../../../core/utils/dag';

export interface AddVariable<T extends VariableModel = VariableModel> {
  global: boolean; // part of dashboard or global
  index: number; // the order in variables list
  model: T;
}

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

export interface VariableIdentifier {
  type: VariableType;
  uuid: string;
}

export interface VariablePayload<T> extends VariableIdentifier {
  data: T;
}

export interface SelectVariableOption {
  option: VariableOption;
  forceSelect: boolean;
  event: MouseEvent<HTMLAnchorElement>;
}

export const addVariable = createAction<PrepareAction<VariablePayload<AddVariable>>>(
  'templating/addVariable',
  (payload: VariablePayload<AddVariable>) => {
    return {
      payload: {
        ...payload,
        uuid: v4(),
      },
    };
  }
);
export const setInitLock = createAction<VariablePayload<undefined>>('templating/setInitLock');
export const resolveInitLock = createAction<VariablePayload<undefined>>('templating/resolveInitLock');
export const removeInitLock = createAction<VariablePayload<undefined>>('templating/removeInitLock');
export const setCurrentVariableValue = createAction<VariablePayload<VariableOption>>('templating/setVariableValue');
export const updateVariableOptions = createAction<VariablePayload<any[]>>('templating/updateVariableOptions');
export const updateVariableTags = createAction<VariablePayload<any[]>>('templating/updateVariableTags');
export const selectVariableOption = createAction<VariablePayload<SelectVariableOption>>(
  'templating/selectVariableOption'
);
export const showQueryVariableDropDown = createAction<VariablePayload<undefined>>(
  'templating/showQueryVariableDropDown'
);
export const hideQueryVariableDropDown = createAction<VariablePayload<undefined>>(
  'templating/hideQueryVariableDropDown'
);
export const variableEditorMounted = createAction<VariablePayload<undefined>>('templating/variableEditorMounted');
export const variableEditorUnMounted = createAction<VariablePayload<undefined>>('templating/variableEditorUnMounted');
export const changeVariableNameSucceeded = createAction<VariablePayload<string>>(
  'templating/changeVariableNameSucceeded'
);
export const changeVariableNameFailed = createAction<VariablePayload<{ newName: string; errorText: string }>>(
  'templating/changeVariableNameFailed'
);

export const variableActions: Array<ActionCreatorWithPayload<VariablePayload<any>>> = [
  addVariable,
  setInitLock,
  resolveInitLock,
  removeInitLock,
  setCurrentVariableValue,
  updateVariableOptions,
  updateVariableTags,
  selectVariableOption,
  showQueryVariableDropDown,
  hideQueryVariableDropDown,
  changeVariableNameSucceeded,
  changeVariableNameFailed,
  variableEditorMounted,
  variableEditorUnMounted,
];

export const toVariablePayload = <T extends {} = undefined>(variable: VariableModel, data?: T): VariablePayload<T> => {
  return { type: variable.type, uuid: variable.uuid, data };
};

export const initDashboardTemplating = (list: VariableModel[]): ThunkResult<void> => {
  return (dispatch, getState) => {
    for (let index = 0; index < list.length; index++) {
      const model = list[index];
      if (!variableAdapters.contains(model.type)) {
        continue;
      }

      dispatch(addVariable(toVariablePayload(model, { global: false, index, model })));
    }
  };
};

export const processVariables = (): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const queryParams = getState().location.query;
    const dependencies: Array<Promise<any>> = [];

    for (let index = 0; index < getVariables(getState()).length; index++) {
      await dispatch(setInitLock(toVariablePayload(getVariables(getState())[index])));
    }

    for (let index = 0; index < getVariables(getState()).length; index++) {
      const variable = getVariables(getState())[index];
      for (const otherVariable of getVariables(getState())) {
        if (variableAdapters.get(variable.type).dependsOn(variable, otherVariable)) {
          dependencies.push(otherVariable.initLock.promise);
        }
      }

      await Promise.all(dependencies);

      const urlValue = queryParams['var-' + variable.name];
      if (urlValue !== void 0) {
        await variableAdapters.get(variable.type).setValueFromUrl(variable, urlValue);
      }

      if (variable.hasOwnProperty('refresh')) {
        const refreshableVariable = variable as QueryVariableModel;
        if (
          refreshableVariable.refresh === VariableRefresh.onDashboardLoad ||
          refreshableVariable.refresh === VariableRefresh.onTimeRangeChanged
        ) {
          await variableAdapters.get(variable.type).updateOptions(refreshableVariable);
        }
      }

      await dispatch(resolveInitLock(toVariablePayload(variable)));
    }

    for (let index = 0; index < getVariables(getState()).length; index++) {
      await dispatch(removeInitLock(toVariablePayload(getVariables(getState())[index])));
    }
  };
};

export const updateQueryVariableOptions = (variable: QueryVariableModel, searchFilter?: string): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const dataSource = await getDatasourceSrv().get(variable.datasource);
    const queryOptions: any = { range: undefined, variable, searchFilter };
    if (variable.refresh === VariableRefresh.onTimeRangeChanged) {
      queryOptions.range = getTimeSrv().timeRange();
    }
    const results = await dataSource.metricFindQuery(variable.query, queryOptions);
    await dispatch(updateVariableOptions(toVariablePayload(variable, results)));

    if (variable.useTags) {
      const tagResults = await dataSource.metricFindQuery(variable.tagsQuery, queryOptions);
      await dispatch(updateVariableTags(toVariablePayload(variable, tagResults)));
    }

    await dispatch(validateVariableSelectionState(variable));
  };
};

export const setOptionFromUrl = (variable: VariableModel, urlValue: UrlQueryValue): ThunkResult<void> => {
  return async (dispatch, getState) => {
    if (!variable.hasOwnProperty('refresh')) {
      return Promise.resolve();
    }

    if (variable.hasOwnProperty('refresh') && (variable as QueryVariableModel).refresh === VariableRefresh.never) {
      return Promise.resolve();
    }

    // updates options
    await variableAdapters.get(variable.type).updateOptions(variable);

    // get variable from state
    const variableFromState: VariableWithOptions = getVariables(getState()).find(
      v => v.name === variable.name
    ) as VariableWithOptions;
    if (!variableFromState) {
      throw new Error(`Couldn't find variable with name: ${variable.name}`);
    }
    // Simple case. Value in url matches existing options text or value.
    let option: VariableOption = variableFromState.options.find(op => {
      return op.text === urlValue || op.value === urlValue;
    });

    if (!option) {
      let defaultText = urlValue as string | string[];
      const defaultValue = urlValue as string | string[];

      if (Array.isArray(urlValue)) {
        // Multiple values in the url. We construct text as a list of texts from all matched options.
        defaultText = (urlValue as string[]).reduce((acc, item) => {
          const t: any = _.find(variableFromState.options, { value: item });
          if (t) {
            acc.push(t.text);
          } else {
            acc.push(item);
          }

          return acc;
        }, []);
      }

      // It is possible that we did not match the value to any existing option. In that case the url value will be
      // used anyway for both text and value.
      option = { text: defaultText, value: defaultValue, selected: false };
    }

    if (variableFromState.hasOwnProperty('multi')) {
      // In case variable is multiple choice, we cast to array to preserve the same behaviour as when selecting
      // the option directly, which will return even single value in an array.
      option = { text: _.castArray(option.text), value: _.castArray(option.value), selected: false };
    }

    await variableAdapters.get(variable.type).setValue(variableFromState, option);
  };
};

export const selectOptionsForCurrentValue = (variable: VariableWithOptions): VariableOption[] => {
  let i, y, value, option;
  const selected: VariableOption[] = [];

  for (i = 0; i < variable.options.length; i++) {
    option = variable.options[i];
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
  variable: VariableWithOptions,
  defaultValue?: string
): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const variableInState = getVariable<VariableWithOptions>(variable.uuid, getState());
    const setValue = variableAdapters.get(variableInState.type).setValue;
    if (!variableInState.current) {
      return setValue(variableInState, {} as VariableOption);
    }

    if (Array.isArray(variableInState.current.value)) {
      const selected = selectOptionsForCurrentValue(variableInState);

      // if none pick first
      if (selected.length === 0) {
        const option = variableInState.options[0];
        return setValue(variableInState, option);
      }

      const option: VariableOption = {
        value: selected.map(v => v.value) as string[],
        text: selected.map(v => v.text) as string[],
        selected: true,
      };
      return setValue(variableInState, option);
    }

    let option: VariableOption = null;

    // 1. find the current value
    option = variableInState.options.find(v => v.text === variableInState.current.text);
    if (option) {
      return setValue(variableInState, option);
    }

    // 2. find the default value
    if (defaultValue) {
      option = variableInState.options.find(v => v.text === defaultValue);
      if (option) {
        return setValue(variableInState, option);
      }
    }

    // 3. use the first value
    if (variableInState.options) {
      const option = variableInState.options[0];
      return setValue(variableInState, option);
    }

    // 4... give up
    return Promise.resolve();
  };
};

export const setOptionAsCurrent = (variable: VariableWithOptions, current: VariableOption): ThunkResult<void> => {
  return async (dispatch, getState) => {
    dispatch(setCurrentVariableValue(toVariablePayload(variable, current)));
    //const selected = selectOptionsForCurrentValue(variableInState);
    return dispatch(variableUpdated(variable));
  };
};

const createGraph = (variables: VariableModel[]) => {
  const g = new Graph();

  variables.forEach(v => {
    g.createNode(v.name);
  });

  variables.forEach(v1 => {
    variables.forEach(v2 => {
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

export const variableUpdated = (variable: VariableModel, emitChangeEvents?: any): ThunkResult<void> => {
  return (dispatch, getState) => {
    // if there is a variable lock ignore cascading update because we are in a boot up scenario
    if (variable.initLock) {
      return Promise.resolve();
    }

    const variables = getVariables(getState());
    const g = createGraph(variables);

    const node = g.getNode(variable.name);
    let promises: Array<Promise<any>> = [];
    if (node) {
      promises = node.getOptimizedInputEdges().map(e => {
        const variable = variables.find(v => v.name === e.inputNode.name);
        return variableAdapters.get(variable.type).updateOptions(variable);
        // return this.updateOptions(this.variables.find(v => v.name === e.inputNode.name));
      });
    }

    return Promise.all(promises).then(() => {
      if (emitChangeEvents) {
        //     this.dashboard.templateVariableValueUpdated();
        //     this.dashboard.startRefresh();
      }
    });
  };
};

export const changeVariableName = (variable: VariableModel, newName: string): ThunkResult<void> => {
  return (dispatch, getState) => {
    let errorText = null;
    if (!newName.match(/^(?!__).*$/)) {
      errorText = "Template names cannot begin with '__', that's reserved for Grafana's global variables";
    }

    if (!newName.match(/^\w+$/)) {
      errorText = 'Only word and digit characters are allowed in variable names';
    }

    const variablesWithSameName = getVariables(getState()).filter(v => v.name === newName && v.uuid !== variable.uuid);
    if (variablesWithSameName.length) {
      errorText = 'Variable with the same name already exists';
    }

    if (errorText) {
      dispatch(changeVariableNameFailed(toVariablePayload(variable, { newName, errorText })));
    }

    if (!errorText) {
      dispatch(changeVariableNameSucceeded(toVariablePayload(variable, newName)));
    }
  };
};

export const changeVariableType = (variable: VariableModel, newType: VariableType): ThunkResult<void> => {
  return (dispatch, getState) => {
    const currentIsAdapted = variableAdapters.contains(variable.type);
    const newIsAdapted = variableAdapters.contains(newType);

    console.log('changeVariableType', variable.type, newType, currentIsAdapted, newIsAdapted);

    // existing type is adapted but new type is not
    if (currentIsAdapted && !newIsAdapted) {
      // delete variable in state
    }

    // existing type is not adapted but new type is
    if (!currentIsAdapted && newIsAdapted) {
      // add variable to state
    }

    // existing type and new type are not adapted
    if (!currentIsAdapted && !newIsAdapted) {
      // Let Angular handle this
      return;
    }

    // existing type and new type are adapted
    if (currentIsAdapted && newIsAdapted) {
      // just change type
    }
  };
};
