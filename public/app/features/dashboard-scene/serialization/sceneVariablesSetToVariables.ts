import { SceneVariableSet, QueryVariable, CustomVariable, DataSourceVariable, ConstantVariable } from '@grafana/scenes';
import { VariableModel, VariableHide, VariableRefresh, VariableSort } from '@grafana/schema';

export function sceneVariablesSetToVariables(set: SceneVariableSet) {
  const variables: VariableModel[] = [];
  for (const variable of set.state.variables) {
    const commonProperties = {
      name: variable.state.name,
      label: variable.state.label,
      description: variable.state.description,
      skipUrlSync: Boolean(variable.state.skipUrlSync),
      hide: variable.state.hide || VariableHide.dontHide,
      type: variable.state.type,
    };
    if (variable instanceof QueryVariable) {
      variables.push({
        ...commonProperties,
        current: {
          // @ts-expect-error
          value: variable.state.value,
          // @ts-expect-error
          text: variable.state.text,
        },
        options: [],
        query: variable.state.query,
        datasource: variable.state.datasource,
        sort: variable.state.sort,
        refresh: variable.state.refresh,
        regex: variable.state.regex,
        allValue: variable.state.allValue,
        includeAll: variable.state.includeAll,
        multi: variable.state.isMulti,
        skipUrlSync: variable.state.skipUrlSync,
        hide: variable.state.hide || VariableHide.dontHide,
      });
    } else if (variable instanceof CustomVariable) {
      variables.push({
        ...commonProperties,
        current: {
          // @ts-expect-error
          text: variable.state.value,
          // @ts-expect-error
          value: variable.state.value,
        },
        options: [],
        query: variable.state.query,
        multi: variable.state.isMulti,
        allValue: variable.state.allValue,
        includeAll: variable.state.includeAll,
      });
    } else if (variable instanceof DataSourceVariable) {
      variables.push({
        ...commonProperties,
        current: {
          // @ts-expect-error
          value: variable.state.value,
          // @ts-expect-error
          text: variable.state.text,
        },
        options: [],
        regex: variable.state.regex,
        refresh: VariableRefresh.onDashboardLoad,
        query: variable.state.pluginId,
        multi: variable.state.isMulti,
        allValue: variable.state.allValue,
        includeAll: variable.state.includeAll,
      });
    } else if (variable instanceof ConstantVariable) {
      variables.push({
        ...commonProperties,
        current: {
          // @ts-expect-error
          value: variable.state.value,
          // @ts-expect-error
          text: variable.state.value,
        },
        // @ts-expect-error
        query: variable.state.value,
        hide: VariableHide.hideVariable,
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
