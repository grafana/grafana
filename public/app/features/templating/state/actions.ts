import { createAction } from '@reduxjs/toolkit';
import { UrlQueryValue } from '@grafana/runtime';
import { stringToJsRegex } from '@grafana/data';

import {
  QueryVariableModel,
  VariableModel,
  VariableOption,
  VariableRefresh,
  VariableTag,
  VariableType,
  VariableWithOptions,
} from '../variable';
import { ThunkResult } from '../../../types';
import { getVariables } from './selectors';
import { variableAdapter } from '../adapters';
import _ from 'lodash';
import { getDatasourceSrv } from '../../plugins/datasource_srv';
import { getTimeSrv } from '../../dashboard/services/TimeSrv';
import templateSrv from '../template_srv';

export interface AddVariable<T extends VariableModel = VariableModel> {
  global: boolean; // part of dashboard or global
  index: number; // the order in variables list
  model: T;
}

export const newVariable = createAction<VariableType>('templating/newVariable');
export const addVariable = createAction<AddVariable>('templating/addVariable');
export const updateVariable = createAction<VariableModel>('templating/updateVariable');
export const setVariableValue = createAction<{ variable: VariableModel; option: VariableOption }>(
  'templating/setVariableValue'
);
export const updateVariableOptions = createAction<{ variable: VariableModel; options: VariableOption[] }>(
  'templating/updateVariableOptions'
);
export const updateVariableTags = createAction<{ variable: VariableModel; tags: VariableTag[] }>(
  'templating/updateVariableTags'
);

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

export const updateQueryVariableOptions = (variable: QueryVariableModel, searchFilter?: string): ThunkResult<void> => {
  const sortVariableValues = (options: any[], sortOrder: number) => {
    if (sortOrder === 0) {
      return options;
    }

    const sortType = Math.ceil(sortOrder / 2);
    const reverseSort = sortOrder % 2 === 0;

    if (sortType === 1) {
      options = _.sortBy(options, 'text');
    } else if (sortType === 2) {
      options = _.sortBy(options, opt => {
        const matches = opt.text.match(/.*?(\d+).*/);
        if (!matches || matches.length < 2) {
          return -1;
        } else {
          return parseInt(matches[1], 10);
        }
      });
    } else if (sortType === 3) {
      options = _.sortBy(options, opt => {
        return _.toLower(opt.text);
      });
    }

    if (reverseSort) {
      options = options.reverse();
    }

    return options;
  };
  const metricNamesToVariableValues = (metricNames: any[]) => {
    let regex, options, i, matches;
    options = [];

    if (variable.regex) {
      regex = stringToJsRegex(templateSrv.replace(variable.regex, {}, 'regex'));
    }
    for (i = 0; i < metricNames.length; i++) {
      const item = metricNames[i];
      let text = item.text === undefined || item.text === null ? item.value : item.text;

      let value = item.value === undefined || item.value === null ? item.text : item.value;

      if (_.isNumber(value)) {
        value = value.toString();
      }

      if (_.isNumber(text)) {
        text = text.toString();
      }

      if (regex) {
        matches = regex.exec(value);
        if (!matches) {
          continue;
        }
        if (matches.length > 1) {
          value = matches[1];
          text = matches[1];
        }
      }

      options.push({ text: text, value: value });
    }

    options = _.uniqBy(options, 'value');
    return sortVariableValues(options, variable.sort);
  };

  return async (dispatch, getState) => {
    const dataSource = await getDatasourceSrv().get(variable.datasource);
    const queryOptions: any = { range: undefined, variable, searchFilter };
    if (variable.refresh === VariableRefresh.onTimeRangeChanged) {
      queryOptions.range = getTimeSrv().timeRange();
    }
    const results = await dataSource.metricFindQuery(variable.query, queryOptions);
    const options = metricNamesToVariableValues(results);
    if (variable.includeAll) {
      options.unshift({ text: 'All', value: '$__all', selected: false });
    }
    if (!options.length) {
      options.push({ text: 'None', value: '', isNone: true, selected: false });
    }

    await dispatch(updateVariableOptions({ variable, options }));

    if (!variable.useTags) {
      return;
    }

    const tagResults = await dataSource.metricFindQuery(variable.tagsQuery, queryOptions);
    const tags: VariableTag[] = [];
    for (let i = 0; i < tagResults.length; i++) {
      tags.push({ text: tagResults[i].text, selected: false });
    }

    await dispatch(updateVariableTags({ variable, tags }));
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
    await variableAdapter[variable.type].updateOptions(variable);

    // get variable from state
    const variableFromState: VariableWithOptions = getVariables(getState()).find(
      v => v.name === variable.name
    ) as VariableWithOptions;
    if (!variableFromState) {
      throw new Error(`Couldn't find variable with name: ${variable.name}`);
    }
    // Simple case. Value in url matches existing options text or value.
    let option: VariableOption = _.find(variableFromState.options, op => {
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

    dispatch(setVariableValue({ variable, option }));
  };
};
