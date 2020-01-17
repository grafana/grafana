import { createAction } from '@reduxjs/toolkit';
import { QueryVariableModel, variableAdapter, VariableModel, VariableRefresh, VariableType } from '../variable';
import { ThunkResult } from '../../../types';
import { getVariables } from './selectors';
import { UrlQueryValue } from '@grafana/runtime';

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
      if (!variableAdapter[model.type].useState) {
        continue;
      }

      dispatch(addVariable({ global: false, index, model }));
    }
  };
};

export class Deferred {
  resolve: any;
  reject: any;
  promise: Promise<any>;
  constructor() {
    this.resolve = null;
    this.reject = null;
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
    Object.freeze(this);
  }
}

export const processVariables = (): ThunkResult<void> => {
  return (dispatch, getState) => {
    const variables = getVariables(getState());
    const queryParams = getState().location.query;
    const dependencies: Array<Promise<any>> = [];

    for (const variable of variables) {
      variable.initLock = new Deferred();
      for (const otherVariable of variables) {
        if (variableAdapter[variable.type].dependsOn(variable, otherVariable)) {
          dependencies.push(otherVariable.initLock.promise);
        }
      }

      Promise.all(dependencies)
        .then(() => {
          const urlValue = queryParams['var-' + variable.name];
          if (urlValue !== void 0) {
            return variableAdapter[variable.type].setOptionFromUrl(variable, urlValue).then(variable.initLock.resolve);
          }

          if (variable.hasOwnProperty('refresh')) {
            const refreshableVariable = variable as QueryVariableModel;
            if (
              refreshableVariable.refresh === VariableRefresh.onDashboardLoad ||
              refreshableVariable.refresh === VariableRefresh.onTimeRangeChanged
            ) {
              return variableAdapter[refreshableVariable.type]
                .updateOptions(refreshableVariable)
                .then(variable.initLock.resolve);
            }
          }

          variable.initLock.resolve();
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
