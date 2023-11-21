import {
  QueryVariable,
  CustomVariable,
  DataSourceVariable,
  ConstantVariable,
  IntervalVariable,
  SceneVariables,
} from '@grafana/scenes';
import { VariableModel, VariableHide, VariableRefresh, VariableSort } from '@grafana/schema';

import { getIntervalsQueryFromNewIntervalModel } from '../utils/utils';

export function sceneVariablesSetToVariables(set: SceneVariables) {
  const variables: VariableModel[] = [];
  for (const variable of set.state.variables) {
    const type = variable.state.type;
    const commonProperties = {
      name: variable.state.name,
      label: variable.state.label,
      description: variable.state.description,
      skipUrlSync: Boolean(variable.state.skipUrlSync),
      hide: variable.state.hide || VariableHide.dontHide,
      type,
    };
    if (type === 'query') {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const queryVariable = variable as QueryVariable;
      variables.push({
        ...commonProperties,
        current: {
          // @ts-expect-error
          value: queryVariable.state.value,
          // @ts-expect-error
          text: queryVariable.state.text,
        },
        options: [],
        query: queryVariable.state.query,
        datasource: queryVariable.state.datasource,
        sort: queryVariable.state.sort,
        refresh: queryVariable.state.refresh,
        regex: queryVariable.state.regex,
        allValue: queryVariable.state.allValue,
        includeAll: queryVariable.state.includeAll,
        multi: queryVariable.state.isMulti,
        skipUrlSync: queryVariable.state.skipUrlSync,
        hide: queryVariable.state.hide || VariableHide.dontHide,
      });
    } else if (type === 'custom') {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const customVariable = variable as CustomVariable;
      variables.push({
        ...commonProperties,
        current: {
          // @ts-expect-error
          text: customVariable.state.value,
          // @ts-expect-error
          value: customVariable.state.value,
        },
        options: [],
        query: customVariable.state.query,
        multi: customVariable.state.isMulti,
        allValue: customVariable.state.allValue,
        includeAll: customVariable.state.includeAll,
      });
    } else if (type === 'datasource') {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const datasourceVariable = variable as DataSourceVariable;
      variables.push({
        ...commonProperties,
        current: {
          // @ts-expect-error
          value: datasourceVariable.state.value,
          // @ts-expect-error
          text: datasourceVariable.state.text,
        },
        options: [],
        regex: datasourceVariable.state.regex,
        refresh: VariableRefresh.onDashboardLoad,
        query: datasourceVariable.state.pluginId,
        multi: datasourceVariable.state.isMulti,
        allValue: datasourceVariable.state.allValue,
        includeAll: datasourceVariable.state.includeAll,
      });
    } else if (type === 'constant') {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const constantVariable = variable as ConstantVariable;
      variables.push({
        ...commonProperties,
        current: {
          // @ts-expect-error
          value: constantVariable.state.value,
          // @ts-expect-error
          text: constantVariable.state.value,
        },
        // @ts-expect-error
        query: constantVariable.state.value,
        hide: VariableHide.hideVariable,
      });
    } else if (type === 'interval') {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const intervalVariable = variable as IntervalVariable;
      const intervals = getIntervalsQueryFromNewIntervalModel(intervalVariable.state.intervals);
      variables.push({
        ...commonProperties,
        current: {
          text: intervalVariable.state.value,
          value: intervalVariable.state.value,
        },
        query: intervals,
        hide: VariableHide.hideVariable,
        refresh: intervalVariable.state.refresh,
        // @ts-expect-error ?? how to fix this without adding the ts-expect-error
        auto: intervalVariable.state.autoEnabled,
        auto_min: intervalVariable.state.autoMinInterval,
        auto_count: intervalVariable.state.autoStepCount,
      });
    } else {
      throw new Error('Unsupported variable type');
    }
  }

  // Remove some defaults
  for (const variable of variables) {
    if (variable.hide === VariableHide.dontHide) {
      delete variable.hide;
    }

    if (!variable.skipUrlSync) {
      delete variable.skipUrlSync;
    }

    if (variable.label === '') {
      delete variable.label;
    }

    if (!variable.multi) {
      delete variable.multi;
    }

    if (variable.sort === VariableSort.disabled) {
      delete variable.sort;
    }
  }

  return variables;
}
