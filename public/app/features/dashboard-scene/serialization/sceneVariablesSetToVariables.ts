import { config } from '@grafana/runtime';
import { MultiValueVariable, SceneVariables, sceneUtils } from '@grafana/scenes';
import { VariableHide, VariableModel, VariableOption, VariableRefresh, VariableSort } from '@grafana/schema';

import { getIntervalsQueryFromNewIntervalModel } from '../utils/utils';

export function sceneVariablesSetToVariables(set: SceneVariables) {
  const variables: VariableModel[] = [];
  for (const variable of set.state.variables) {
    const commonProperties = {
      name: variable.state.name,
      label: variable.state.label,
      description: variable.state.description ?? undefined,
      skipUrlSync: Boolean(variable.state.skipUrlSync),
      hide: variable.state.hide || VariableHide.dontHide,
      type: variable.state.type,
    };
    if (sceneUtils.isQueryVariable(variable)) {
      let options: VariableOption[] = [];
      // Not sure if we actually have to still support this option given
      // that it's not exposed in the UI
      if (variable.state.refresh === VariableRefresh.never) {
        options = variableValueOptionsToVariableOptions(variable.state);
      }
      variables.push({
        ...commonProperties,
        current: {
          // @ts-expect-error
          value: variable.state.value,
          // @ts-expect-error
          text: variable.state.text,
        },
        options,
        query: variable.state.query,
        definition: variable.state.definition,
        datasource: variable.state.datasource,
        sort: variable.state.sort,
        refresh: variable.state.refresh,
        regex: variable.state.regex,
        allValue: variable.state.allValue,
        includeAll: variable.state.includeAll,
        multi: variable.state.isMulti,
        skipUrlSync: variable.state.skipUrlSync,
      });
    } else if (sceneUtils.isCustomVariable(variable)) {
      variables.push({
        ...commonProperties,
        current: {
          // @ts-expect-error
          text: variable.state.value,
          // @ts-expect-error
          value: variable.state.value,
        },
        options: variableValueOptionsToVariableOptions(variable.state),
        query: variable.state.query,
        multi: variable.state.isMulti,
        allValue: variable.state.allValue,
        includeAll: variable.state.includeAll,
      });
    } else if (sceneUtils.isDataSourceVariable(variable)) {
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
    } else if (sceneUtils.isConstantVariable(variable)) {
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
    } else if (sceneUtils.isIntervalVariable(variable)) {
      const intervals = getIntervalsQueryFromNewIntervalModel(variable.state.intervals);
      variables.push({
        ...commonProperties,
        current: {
          text: variable.state.value,
          value: variable.state.value,
        },
        query: intervals,
        refresh: variable.state.refresh,
        options: variable.state.intervals.map((interval) => ({
          value: interval,
          text: interval,
          selected: interval === variable.state.value,
        })),
        // @ts-expect-error ?? how to fix this without adding the ts-expect-error
        auto: variable.state.autoEnabled,
        auto_min: variable.state.autoMinInterval,
        auto_count: variable.state.autoStepCount,
      });
    } else if (sceneUtils.isTextBoxVariable(variable)) {
      const current = {
        text: variable.state.value,
        value: variable.state.value,
      };

      variables.push({
        ...commonProperties,
        current,
        options: [{ ...current, selected: true }],
        query: variable.state.value,
      });
    } else if (sceneUtils.isGroupByVariable(variable) && config.featureToggles.groupByVariable) {
      variables.push({
        ...commonProperties,
        datasource: variable.state.datasource,
        // Only persist the statically defined options
        options: variable.state.defaultOptions?.map((option) => ({
          text: option.text,
          value: String(option.value),
        })),
        current: {
          // @ts-expect-error
          text: variable.state.text,
          // @ts-expect-error
          value: variable.state.value,
        },
      });
    } else if (sceneUtils.isAdHocVariable(variable)) {
      variables.push({
        ...commonProperties,
        name: variable.state.name,
        type: 'adhoc',
        datasource: variable.state.datasource,
        // @ts-expect-error
        baseFilters: variable.state.baseFilters,
        filters: variable.state.filters,
        defaultKeys: variable.state.defaultKeys,
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

function variableValueOptionsToVariableOptions(varState: MultiValueVariable['state']): VariableOption[] {
  return varState.options.map((o) => ({
    value: String(o.value),
    text: o.label,
    selected: Array.isArray(varState.value) ? varState.value.includes(o.value) : varState.value === o.value,
  }));
}
