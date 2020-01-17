import { UrlQueryValue } from '@grafana/runtime';
import { Reducer } from 'redux';
import { containsVariable, QueryVariableModel, VariableModel, VariableType } from '../variable';
import { queryVariablesReducer } from '../state/queryVariablesReducer';
import { setOptionFromUrl, updateQueryVariableOptions } from '../state/actions';
import { store } from '../../../store/store';

export interface VariableAdapterProps<T extends VariableModel> {
  dependsOn: (variable: T, variableToTest: T) => boolean;
  setOptionFromUrl: (variable: T, urlValue: UrlQueryValue) => Promise<any>;
  updateOptions: (variable: T, searchFilter?: string) => Promise<any>;
  useState: boolean;
  getReducer: () => Reducer;
}

export const queryVariableAdapter = (): VariableAdapterProps<QueryVariableModel> => ({
  useState: true,
  getReducer: () => queryVariablesReducer,
  dependsOn: (variable, variableToTest) => {
    return containsVariable(variable.query, variable.datasource, variable.regex, variableToTest.name);
  },
  setOptionFromUrl: async (variable, urlValue) => {
    return new Promise(async () => {
      await store.dispatch(setOptionFromUrl(variable, urlValue) as any);
    });
  },
  updateOptions: (variable, searchFilter) => {
    return new Promise(async () => {
      await store.dispatch(updateQueryVariableOptions(variable, searchFilter) as any);
    });
  },
});

export const notMigratedVariableAdapter = (): VariableAdapterProps<any> => ({
  useState: false,
  getReducer: () => state => state,
  dependsOn: (variable, variableToTest) => {
    return false;
  },
  setOptionFromUrl: (variable, urlValue) => Promise.resolve(),
  updateOptions: (variable, searchFilter) => Promise.resolve(),
});

export const variableAdapter: Record<VariableType, VariableAdapterProps<any>> = {
  query: queryVariableAdapter(),
  adhoc: notMigratedVariableAdapter(),
  constant: notMigratedVariableAdapter(),
  datasource: notMigratedVariableAdapter(),
  custom: notMigratedVariableAdapter(),
  interval: notMigratedVariableAdapter(),
  textbox: notMigratedVariableAdapter(),
};

// export const variableAdapter = (type: VariableType): VariableAdapterProps<any> => {
//   if (type === 'query') {
//     return queryVariableAdapter();
//   }
//
//   return notMigratedVariableAdapter;
// };
