/**
 * Shared variable utilities for mutation commands.
 *
 * Contains helpers used across add/remove/update variable commands.
 */

import { config } from '@grafana/runtime';
import { type sceneGraph, SceneVariableSet, sceneUtils, type SceneVariable } from '@grafana/scenes';
import {
  type AdhocVariableKind,
  type ConstantVariableKind,
  type CustomVariableKind,
  type DataQueryKind,
  type DatasourceVariableKind,
  type GroupByVariableKind,
  type IntervalVariableKind,
  type QueryVariableKind,
  type SwitchVariableKind,
  type TextVariableKind,
  type VariableKind,
  type VariableOption,
  defaultDataQueryKind,
  defaultIntervalVariableSpec,
  defaultVariableHide,
} from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { getDefaultDatasource } from 'app/features/dashboard/api/ResponseTransformers';

import { getDataSourceForQuery } from '../../serialization/layoutSerializers/utils';
import { validateFiltersOrigin } from '../../serialization/sceneVariablesSetToVariables';
import { getDataQueryKind, getElementDatasource } from '../../serialization/transformSceneToSaveModelSchemaV2';
import {
  LEGACY_STRING_VALUE_KEY,
  transformSortVariableToEnum,
  transformVariableHideToEnum,
  transformVariableRefreshToEnum,
} from '../../serialization/transformToV2TypesUtils';
import { getIntervalsQueryFromNewIntervalModel } from '../../utils/utils';

/**
 * Replace the dashboard's variable set with a new set containing the given variables.
 * This ensures consistent lifecycle behavior across add/remove/update operations.
 */
export function replaceVariableSet(
  scene: Parameters<typeof sceneGraph.getVariables>[0],
  variables: ReturnType<typeof sceneGraph.getVariables>['state']['variables']
): SceneVariableSet {
  const newVarSet = new SceneVariableSet({ variables });
  scene.setState({ $variables: newVarSet });
  newVarSet.activate();
  return newVarSet;
}

/**
 * Convert a single SceneVariable into a v2beta1 VariableKind.
 *
 * This is the reverse of createSceneVariableFromVariableModel. It extracts
 * the current runtime state of one variable and returns the schema representation
 * suitable for passing to ADD_VARIABLE or UPDATE_VARIABLE commands.
 *
 * The parent set is optional -- when provided, it is used to resolve datasource
 * references for QueryVariable. When omitted, datasource resolution is skipped.
 */
export function createVariableKindFromSceneVariable(
  variable: SceneVariable,
  parentSet?: Parameters<typeof sceneGraph.getVariables>[0]
): VariableKind {
  const commonProperties = {
    name: variable.state.name,
    label: variable.state.label,
    description: variable.state.description ?? undefined,
    skipUrlSync: Boolean(variable.state.skipUrlSync),
    hide: transformVariableHideToEnum(variable.state.hide) || defaultVariableHide(),
  };

  const currentVariableOption: VariableOption = {
    // @ts-expect-error -- SceneVariable value/text not typed on base state
    value: variable.state.value,
    // @ts-expect-error
    text: variable.state.text,
  };

  if (sceneUtils.isQueryVariable(variable)) {
    const query = variable.state.query;
    let dataQuery: DataQueryKind | string;

    const datasource = parentSet
      ? getElementDatasource(
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          parentSet as Parameters<typeof getElementDatasource>[0],
          variable,
          'variable'
        )
      : undefined;

    if (typeof query !== 'string') {
      dataQuery = {
        kind: 'DataQuery',
        version: defaultDataQueryKind().version,
        group: datasource?.type || getDataQueryKind(query),
        ...(datasource?.uid && { datasource: { name: datasource.uid } }),
        spec: query,
      };
    } else {
      const spec: Record<string, string> = {};
      if (query) {
        spec[LEGACY_STRING_VALUE_KEY] = query;
      }
      dataQuery = {
        kind: 'DataQuery',
        version: defaultDataQueryKind().version,
        group: datasource?.type || getDataQueryKind(query),
        ...(datasource?.uid && { datasource: { name: datasource.uid } }),
        spec,
      };
    }

    const result: QueryVariableKind = {
      kind: 'QueryVariable',
      spec: {
        ...commonProperties,
        current: currentVariableOption,
        options: [],
        query: dataQuery,
        definition: variable.state.definition,
        sort: transformSortVariableToEnum(variable.state.sort),
        refresh: transformVariableRefreshToEnum(variable.state.refresh),
        regex: variable.state.regex ?? '',
        allValue: variable.state.allValue,
        includeAll: variable.state.includeAll || false,
        multi: variable.state.isMulti || false,
        skipUrlSync: variable.state.skipUrlSync || false,
        allowCustomValue: variable.state.allowCustomValue ?? true,
      },
    };
    return result;
  }

  if (sceneUtils.isCustomVariable(variable)) {
    const result: CustomVariableKind = {
      kind: 'CustomVariable',
      spec: {
        ...commonProperties,
        current: currentVariableOption,
        options: [],
        query: variable.state.query,
        multi: variable.state.isMulti || false,
        allValue: variable.state.allValue,
        includeAll: variable.state.includeAll ?? false,
        allowCustomValue: variable.state.allowCustomValue ?? true,
        valuesFormat: variable.state.valuesFormat ?? 'csv',
      },
    };
    return result;
  }

  if (sceneUtils.isDataSourceVariable(variable)) {
    const result: DatasourceVariableKind = {
      kind: 'DatasourceVariable',
      spec: {
        ...commonProperties,
        current: currentVariableOption,
        options: [],
        regex: variable.state.regex ?? '',
        refresh: 'onDashboardLoad',
        pluginId: variable.state.pluginId ?? getDefaultDatasource().type,
        multi: variable.state.isMulti || false,
        includeAll: variable.state.includeAll || false,
        allowCustomValue: variable.state.allowCustomValue ?? true,
        ...(variable.state.allValue !== undefined && { allValue: variable.state.allValue }),
      },
    };
    return result;
  }

  if (sceneUtils.isConstantVariable(variable)) {
    const value = variable.state.value ? String(variable.state.value) : '';
    const result: ConstantVariableKind = {
      kind: 'ConstantVariable',
      spec: {
        ...commonProperties,
        current: { text: value, value },
        query: value,
      },
    };
    return result;
  }

  if (sceneUtils.isIntervalVariable(variable)) {
    const intervals = getIntervalsQueryFromNewIntervalModel(variable.state.intervals);
    const result: IntervalVariableKind = {
      kind: 'IntervalVariable',
      spec: {
        ...commonProperties,
        current: {
          ...currentVariableOption,
          text: variable.state.value,
        },
        query: intervals,
        refresh: defaultIntervalVariableSpec().refresh,
        options: variable.state.intervals.map((interval) => ({
          value: interval,
          text: interval,
          selected: interval === variable.state.value,
        })),
        auto: variable.state.autoEnabled ?? defaultIntervalVariableSpec().auto,
        auto_min: variable.state.autoMinInterval ?? defaultIntervalVariableSpec().auto_min,
        auto_count: variable.state.autoStepCount ?? defaultIntervalVariableSpec().auto_count,
      },
    };
    return result;
  }

  if (sceneUtils.isTextBoxVariable(variable)) {
    const current = {
      text: variable.state.value ?? '',
      value: variable.state.value ?? '',
    };
    const result: TextVariableKind = {
      kind: 'TextVariable',
      spec: {
        ...commonProperties,
        current,
        query: variable.state.value ?? '',
      },
    };
    return result;
  }

  if (sceneUtils.isGroupByVariable(variable) && config.featureToggles.groupByVariable) {
    // @ts-expect-error
    const defaultVariableOptionValue: VariableOption | undefined = variable.state.defaultValue
      ? {
          value: variable.state.defaultValue.value,
          text: variable.state.defaultValue.text,
        }
      : undefined;

    const ds = getDataSourceForQuery(
      variable.state.datasource,
      variable.state.datasource?.type || getDefaultDatasource().type!
    );

    const result: GroupByVariableKind = {
      kind: 'GroupByVariable',
      group: ds.type!,
      datasource: { name: ds.uid },
      spec: {
        ...commonProperties,
        options:
          variable.state.defaultOptions?.map((option) => ({
            text: option.text,
            value: String(option.value),
          })) || [],
        current: currentVariableOption,
        defaultValue: defaultVariableOptionValue,
        multi: variable.state.isMulti || false,
      },
    };
    return result;
  }

  if (sceneUtils.isAdHocVariable(variable)) {
    const ds = getDataSourceForQuery(
      variable.state.datasource,
      variable.state.datasource?.type || getDefaultDatasource().type!
    );
    const result: AdhocVariableKind = {
      kind: 'AdhocVariable',
      group: ds.type!,
      datasource: { name: ds.uid },
      spec: {
        ...commonProperties,
        baseFilters: validateFiltersOrigin(variable.state.baseFilters) || [],
        filters: [
          ...validateFiltersOrigin(variable.getOriginalFilters()).map(
            ({ key, operator, value, values, keyLabel, valueLabels, origin }) => ({
              key,
              origin,
              value,
              values,
              valueLabels,
              keyLabel,
              operator,
            })
          ),
          ...validateFiltersOrigin(variable.state.filters),
        ],
        defaultKeys: variable.state.defaultKeys || [],
        allowCustomValue: variable.state.allowCustomValue ?? true,
      },
    };
    return result;
  }

  if (sceneUtils.isSwitchVariable(variable)) {
    const result: SwitchVariableKind = {
      kind: 'SwitchVariable',
      spec: {
        ...commonProperties,
        current: variable.state.value,
        enabledValue: variable.state.enabledValue,
        disabledValue: variable.state.disabledValue,
      },
    };
    return result;
  }

  throw new Error(`Unsupported variable type: ${variable.state.type}`);
}
