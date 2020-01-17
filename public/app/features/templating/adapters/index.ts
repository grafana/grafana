import { UrlQueryValue } from '@grafana/runtime';
import { Reducer } from 'redux';
import { containsVariable, QueryVariableModel, VariableModel, VariableType } from '../variable';
import { queryVariablesReducer } from '../state/queryVariable';

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
    return Promise.resolve();
    // await store.dispatch(setOptionFromUrl(variable, urlValue));
  },
  updateOptions: async (variable, searchFilter) => {
    return Promise.resolve();
    // return getDatasourceSrv()
    //   .get(this.datasource)
    //   .then(ds => this.updateOptionsFromMetricFindQuery(ds, searchFilter))
    //   .then(this.updateTags.bind(this))
    //   .then(this.variableSrv.validateVariableSelectionState.bind(this.variableSrv, this));
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
