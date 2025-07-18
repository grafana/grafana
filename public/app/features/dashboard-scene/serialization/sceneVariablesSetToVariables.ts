import { config } from '@grafana/runtime';
import {
  AdHocFilterWithLabels as SceneAdHocFilterWithLabels,
  MultiValueVariable,
  SceneVariables,
  sceneUtils,
  SceneVariable,
} from '@grafana/scenes';
import {
  VariableModel,
  VariableRefresh as OldVariableRefresh,
  VariableHide as OldVariableHide,
  VariableSort as OldVariableSort,
} from '@grafana/schema';
import {
  AdhocVariableKind,
  ConstantVariableKind,
  CustomVariableKind,
  DataQueryKind,
  DatasourceVariableKind,
  IntervalVariableKind,
  QueryVariableKind,
  TextVariableKind,
  GroupByVariableKind,
  defaultVariableHide,
  VariableOption,
  AdHocFilterWithLabels,
} from '@grafana/schema/dist/esm/schema/dashboard/v2alpha1/types.spec.gen';

import { getIntervalsQueryFromNewIntervalModel } from '../utils/utils';

import { DSReferencesMapping } from './DashboardSceneSerializer';
import { getDataQueryKind, getDataQuerySpec, getElementDatasource } from './transformSceneToSaveModelSchemaV2';
import {
  transformVariableRefreshToEnum,
  transformVariableHideToEnum,
  transformSortVariableToEnum,
  LEGACY_STRING_VALUE_KEY,
} from './transformToV2TypesUtils';
/**
 * Converts a SceneVariables object into an array of VariableModel objects.
 * @param set - The SceneVariables object containing the variables to convert.
 * @param keepQueryOptions - (Optional) A boolean flag indicating whether to keep the options for query variables.
 *                           This should be set to `false` when variables are saved in the dashboard model,
 *                           but should be set to `true` when variables are used in the templateSrv to keep them in sync.
 *                           If `true`, the options for query variables are kept.
 *  */

export function sceneVariablesSetToVariables(set: SceneVariables, keepQueryOptions?: boolean) {
  const variables: VariableModel[] = [];

  for (const variable of set.state.variables) {
    const commonProperties = {
      name: variable.state.name,
      label: variable.state.label,
      description: variable.state.description ?? undefined,
      skipUrlSync: Boolean(variable.state.skipUrlSync),
      hide: variable.state.hide || OldVariableHide.dontHide,
      type: variable.state.type,
    };

    if (sceneUtils.isQueryVariable(variable)) {
      let options: VariableOption[] = [];
      // Not sure if we actually have to still support this option given
      // that it's not exposed in the UI
      if (transformVariableRefreshToEnum(variable.state.refresh) === 'never' || keepQueryOptions) {
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
        datasource: getElementDatasource(set, variable, 'variable'),
        sort: variable.state.sort,
        refresh: variable.state.refresh,
        regex: variable.state.regex,
        allValue: variable.state.allValue,
        includeAll: variable.state.includeAll,
        multi: variable.state.isMulti,
        allowCustomValue: variable.state.allowCustomValue,
        skipUrlSync: variable.state.skipUrlSync,
        staticOptions: variable.state.staticOptions?.map((option) => ({
          text: option.label,
          value: String(option.value),
        })),
        staticOptionsOrder: variable.state.staticOptionsOrder,
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
        allowCustomValue: variable.state.allowCustomValue,
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
        refresh: OldVariableRefresh.onDashboardLoad,
        query: variable.state.pluginId,
        multi: variable.state.isMulti,
        allValue: variable.state.allValue,
        includeAll: variable.state.includeAll,
        allowCustomValue: variable.state.allowCustomValue,
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
        hide: OldVariableHide.hideVariable,
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
      // @ts-expect-error
      const defaultVariableOption: VariableOption | undefined = variable.state.defaultValue
        ? {
            value: variable.state.defaultValue.value,
            text: variable.state.defaultValue.text,
          }
        : undefined;

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
        defaultValue: defaultVariableOption,
        allowCustomValue: variable.state.allowCustomValue,
      });
    } else if (sceneUtils.isAdHocVariable(variable)) {
      variables.push({
        ...commonProperties,
        datasource: variable.state.datasource,
        allowCustomValue: variable.state.allowCustomValue,
        // @ts-expect-error
        baseFilters: variable.state.baseFilters || [],
        filters: [...validateFiltersOrigin(variable.state.originFilters), ...variable.state.filters],
        defaultKeys: variable.state.defaultKeys,
      });
    } else if (variable.state.type === 'system') {
      // Not persisted
    } else {
      throw new Error('Unsupported variable type');
    }
  }

  // Remove some defaults
  for (const variable of variables) {
    if (variable.hide === OldVariableHide.dontHide) {
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

    if (variable.sort === OldVariableSort.disabled) {
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

export function sceneVariablesSetToSchemaV2Variables(
  set: SceneVariables,
  keepQueryOptions?: boolean,
  dsReferencesMapping?: DSReferencesMapping
): Array<
  | QueryVariableKind
  | TextVariableKind
  | IntervalVariableKind
  | DatasourceVariableKind
  | CustomVariableKind
  | ConstantVariableKind
  | GroupByVariableKind
  | AdhocVariableKind
> {
  let variables: Array<
    | QueryVariableKind
    | TextVariableKind
    | IntervalVariableKind
    | DatasourceVariableKind
    | CustomVariableKind
    | ConstantVariableKind
    | GroupByVariableKind
    | AdhocVariableKind
  > = [];

  for (const variable of set.state.variables) {
    const commonProperties = {
      name: variable.state.name,
      label: variable.state.label,
      description: variable.state.description ?? undefined,
      skipUrlSync: Boolean(variable.state.skipUrlSync),
      hide: transformVariableHideToEnum(variable.state.hide) || defaultVariableHide(),
    };

    // current: VariableOption;
    const currentVariableOption: VariableOption = {
      // @ts-expect-error
      value: variable.state.value,
      // @ts-expect-error
      text: variable.state.text,
    };

    let options: VariableOption[] = [];
    if (sceneUtils.isQueryVariable(variable)) {
      // Not sure if we actually have to still support this option given
      // that it's not exposed in the UI
      if (transformVariableRefreshToEnum(variable.state.refresh) === 'never' || keepQueryOptions) {
        options = variableValueOptionsToVariableOptions(variable.state);
      }
      const query = variable.state.query;
      let dataQuery: DataQueryKind | string;
      if (typeof query !== 'string') {
        dataQuery = {
          kind: variable.state.datasource?.type ?? getDataQueryKind(query),
          spec: getDataQuerySpec(query),
        };
      } else {
        dataQuery = {
          kind: variable.state.datasource?.type ?? getDataQueryKind(query),
          spec: {
            [LEGACY_STRING_VALUE_KEY]: query,
          },
        };
      }
      const queryVariable: QueryVariableKind = {
        kind: 'QueryVariable',
        spec: {
          ...commonProperties,
          current: currentVariableOption,
          options,
          query: dataQuery,
          definition: variable.state.definition,
          datasource: getElementDatasource(set, variable, 'variable', undefined, dsReferencesMapping),
          sort: transformSortVariableToEnum(variable.state.sort),
          refresh: transformVariableRefreshToEnum(variable.state.refresh),
          regex: variable.state.regex,
          allValue: variable.state.allValue,
          includeAll: variable.state.includeAll || false,
          multi: variable.state.isMulti || false,
          skipUrlSync: variable.state.skipUrlSync || false,
          allowCustomValue: variable.state.allowCustomValue ?? true,
          staticOptions: variable.state.staticOptions?.map((option) => ({
            text: option.label,
            value: String(option.value),
          })),
          staticOptionsOrder: variable.state.staticOptionsOrder,
        },
      };
      variables.push(queryVariable);
    } else if (sceneUtils.isCustomVariable(variable)) {
      options = variableValueOptionsToVariableOptions(variable.state);
      const customVariable: CustomVariableKind = {
        kind: 'CustomVariable',
        spec: {
          ...commonProperties,
          current: currentVariableOption,
          options,
          query: variable.state.query,
          multi: variable.state.isMulti || false,
          allValue: variable.state.allValue,
          includeAll: variable.state.includeAll ?? false,
          allowCustomValue: variable.state.allowCustomValue ?? true,
        },
      };
      variables.push(customVariable);
    } else if (sceneUtils.isDataSourceVariable(variable)) {
      const datasourceVariable: DatasourceVariableKind = {
        kind: 'DatasourceVariable',
        spec: {
          ...commonProperties,
          current: currentVariableOption,
          options: [],
          regex: variable.state.regex,
          refresh: 'onDashboardLoad',
          pluginId: variable.state.pluginId,
          multi: variable.state.isMulti || false,
          includeAll: variable.state.includeAll || false,
          allowCustomValue: variable.state.allowCustomValue ?? true,
        },
      };

      if (variable.state.allValue !== undefined) {
        datasourceVariable.spec.allValue = variable.state.allValue;
      }

      variables.push(datasourceVariable);
    } else if (sceneUtils.isConstantVariable(variable)) {
      const constantVariable: ConstantVariableKind = {
        kind: 'ConstantVariable',
        spec: {
          ...commonProperties,
          current: {
            ...currentVariableOption,
            // Constant variable doesn't use text state
            text: String(variable.state.value),
          },
          // @ts-expect-error
          query: variable.state.value,
        },
      };
      variables.push(constantVariable);
    } else if (sceneUtils.isIntervalVariable(variable)) {
      const intervals = getIntervalsQueryFromNewIntervalModel(variable.state.intervals);
      const intervalVariable: IntervalVariableKind = {
        kind: 'IntervalVariable',
        spec: {
          ...commonProperties,
          current: {
            ...currentVariableOption,
            // Interval variable doesn't use text state
            text: variable.state.value,
          },
          query: intervals,
          refresh: 'onTimeRangeChanged',
          options: variable.state.intervals.map((interval) => ({
            value: interval,
            text: interval,
            selected: interval === variable.state.value,
          })),
          auto: variable.state.autoEnabled,
          auto_min: variable.state.autoMinInterval,
          auto_count: variable.state.autoStepCount,
        },
      };
      variables.push(intervalVariable);
    } else if (sceneUtils.isTextBoxVariable(variable)) {
      const current = {
        text: variable.state.value,
        value: variable.state.value,
      };

      const textBoxVariable: TextVariableKind = {
        kind: 'TextVariable',
        spec: {
          ...commonProperties,
          current,
          query: variable.state.value,
        },
      };

      variables.push(textBoxVariable);
    } else if (sceneUtils.isGroupByVariable(variable) && config.featureToggles.groupByVariable) {
      options = variableValueOptionsToVariableOptions(variable.state);

      // @ts-expect-error
      const defaultVariableOption: VariableOption | undefined = variable.state.defaultValue
        ? {
            value: variable.state.defaultValue.value,
            text: variable.state.defaultValue.text,
          }
        : undefined;

      const groupVariable: GroupByVariableKind = {
        kind: 'GroupByVariable',
        spec: {
          ...commonProperties,
          datasource: variable.state.datasource || {}, // FIXME what is the default value?,
          // Only persist the statically defined options
          options:
            variable.state.defaultOptions?.map((option) => ({
              text: option.text,
              value: String(option.value),
            })) || [],
          current: currentVariableOption,
          defaultValue: defaultVariableOption,
          multi: variable.state.isMulti || false,
        },
      };
      variables.push(groupVariable);
    } else if (sceneUtils.isAdHocVariable(variable)) {
      const adhocVariable: AdhocVariableKind = {
        kind: 'AdhocVariable',
        spec: {
          ...commonProperties,
          name: variable.state.name,
          datasource: variable.state.datasource || {}, //FIXME what is the default value?
          baseFilters: validateFiltersOrigin(variable.state.baseFilters) || [],
          filters: [
            ...validateFiltersOrigin(variable.state.originFilters),
            ...validateFiltersOrigin(variable.state.filters),
          ],
          defaultKeys: variable.state.defaultKeys || [], //FIXME what is the default value?
          allowCustomValue: variable.state.allowCustomValue ?? true,
        },
      };
      variables.push(adhocVariable);
    } else if (variable.state.type === 'system') {
      // Do nothing
    } else {
      throw new Error('Unsupported variable type: ' + variable.state.type);
    }
  }

  return variables;
}

export function validateFiltersOrigin(filters?: SceneAdHocFilterWithLabels[]): AdHocFilterWithLabels[] {
  // Only keep dashboard originated filters in the schema
  return filters?.filter((f): f is AdHocFilterWithLabels => !f.origin || f.origin === 'dashboard') || [];
}

export function isVariableEditable(variable: SceneVariable) {
  return variable.state.type !== 'system';
}
