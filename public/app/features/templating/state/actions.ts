import { createAction } from '@reduxjs/toolkit';
import { UrlQueryValue } from '@grafana/runtime';

import { QueryVariableModel, VariableModel, VariableRefresh, VariableType } from '../variable';
import { ThunkResult } from '../../../types';
import { getVariables } from './selectors';
import { variableAdapter } from '../adapters';

export interface AddVariable<T extends VariableModel = VariableModel> {
  global: boolean; // part of dashboard or global
  index: number; // the order in variables list
  model: T;
}

export const newVariable = createAction<VariableType>('templating/newVariable');
export const addVariable = createAction<AddVariable>('templating/addVariable');
export const updateVariable = createAction<VariableModel>('templating/updateVariable');

export const initDashboardTemplating = (list: VariableModel[]): ThunkResult<void> => {
  return (dispatch, getState) => {
    for (let index = 0; index < list.length; index++) {
      const model = list[index];
      if (model.type !== 'query') {
        continue;
      }

      dispatch(addVariable({ global: false, index, model }));
    }
  };
};

export const processVariables = (): ThunkResult<void> => {
  return (dispatch, getState) => {
    const variables = getVariables(getState());
    const queryParams = getState().location.query;
    const dependencies: Array<Promise<any>> = [];

    for (let index = 0; index < variables.length; index++) {
      let variableResolve: any = null;
      const promise = new Promise(resolve => {
        variableResolve = resolve;
      });
      const variable = { ...variables[index] };
      variable.initLock = promise;
      for (const otherVariable of variables) {
        if (variableAdapter[variable.type].dependsOn(variable, otherVariable)) {
          dependencies.push(otherVariable.initLock);
        }
      }

      Promise.all(dependencies)
        .then(() => {
          const urlValue = queryParams['var-' + variable.name];
          if (urlValue !== void 0) {
            return variableAdapter[variable.type].setOptionFromUrl(variable, urlValue).then(variableResolve);
          }

          if (variable.hasOwnProperty('refresh')) {
            const refreshableVariable = variable as QueryVariableModel;
            if (
              refreshableVariable.refresh === VariableRefresh.onDashboardLoad ||
              refreshableVariable.refresh === VariableRefresh.onTimeRangeChanged
            ) {
              return variableAdapter[variable.type].updateOptions(refreshableVariable).then(variableResolve);
            }
          }

          variableResolve();
          return Promise.resolve();
        })
        .finally(() => {
          delete variable.initLock;
        });
    }
  };
};

export const setOptionFromUrl = (variable: VariableModel, urlValue: UrlQueryValue): ThunkResult<void> => {
  return (dispatch, getState) => ({});
};
