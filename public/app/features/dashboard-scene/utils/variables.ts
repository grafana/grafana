import { AdHocVariableFilter, TypedVariableModel } from '@grafana/data';
import { config, getDataSourceSrv } from '@grafana/runtime';
import {
  AdHocFiltersVariable,
  ConstantVariable,
  CustomVariable,
  DataSourceVariable,
  GroupByVariable,
  IntervalVariable,
  QueryVariable,
  SceneVariable,
  SceneVariableSet,
  ScopesVariable,
  TextBoxVariable,
} from '@grafana/scenes';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';

import { SnapshotVariable } from '../serialization/custom-variables/SnapshotVariable';

import { getCurrentValueForOldIntervalModel, getIntervalsFromQueryString } from './utils';

const DEFAULT_DATASOURCE = 'default';

export function createVariablesForDashboard(oldModel: DashboardModel) {
  const variableObjects = oldModel.templating.list
    .map((v) => {
      try {
        return createSceneVariableFromVariableModel(v);
      } catch (err) {
        console.error(err);
        return null;
      }
    })
    // TODO: Remove filter
    // Added temporarily to allow skipping non-compatible variables
    .filter((v): v is SceneVariable => Boolean(v));

  if (config.featureToggles.scopeFilters) {
    variableObjects.push(new ScopesVariable({ enable: true }));
  }

  return new SceneVariableSet({
    variables: variableObjects,
  });
}

export function createVariablesForSnapshot(oldModel: DashboardModel) {
  const variableObjects = oldModel.templating.list
    .map((v) => {
      try {
        // for adhoc we are using the AdHocFiltersVariable from scenes becuase of its complexity
        if (v.type === 'adhoc') {
          return new AdHocFiltersVariable({
            name: v.name,
            label: v.label,
            readOnly: true,
            description: v.description,
            skipUrlSync: v.skipUrlSync,
            hide: v.hide,
            datasource: v.datasource,
            applyMode: 'auto',
            filters: v.filters ?? [],
            baseFilters: v.baseFilters ?? [],
            defaultKeys: v.defaultKeys,
            useQueriesAsFilterForOptions: true,
            layout: config.featureToggles.newFiltersUI ? 'combobox' : undefined,
            supportsMultiValueOperators: Boolean(
              getDataSourceSrv().getInstanceSettings(v.datasource)?.meta.multiValueFilterOperators
            ),
          });
        }
        // for other variable types we are using the SnapshotVariable
        return createSnapshotVariable(v);
      } catch (err) {
        console.error(err);
        return null;
      }
    })
    // TODO: Remove filter
    // Added temporarily to allow skipping non-compatible variables
    .filter((v): v is SceneVariable => Boolean(v));

  return new SceneVariableSet({
    variables: variableObjects,
  });
}

/** Snapshots variables are read-only and should not be updated */
export function createSnapshotVariable(variable: TypedVariableModel): SceneVariable {
  let snapshotVariable: SnapshotVariable;
  let current: { value: string | string[]; text: string | string[] };
  if (variable.type === 'interval') {
    const intervals = getIntervalsFromQueryString(variable.query);
    const currentInterval = getCurrentValueForOldIntervalModel(variable, intervals);
    snapshotVariable = new SnapshotVariable({
      name: variable.name,
      label: variable.label,
      description: variable.description,
      value: currentInterval,
      text: currentInterval,
      hide: variable.hide,
    });
    return snapshotVariable;
  }

  if (variable.type === 'system' || variable.type === 'constant' || variable.type === 'adhoc') {
    current = {
      value: '',
      text: '',
    };
  } else {
    current = {
      value: variable.current?.value ?? '',
      text: variable.current?.text ?? '',
    };
  }

  snapshotVariable = new SnapshotVariable({
    name: variable.name,
    label: variable.label,
    description: variable.description,
    value: current?.value ?? '',
    text: current?.text ?? '',
    hide: variable.hide,
  });
  return snapshotVariable;
}

export function createSceneVariableFromVariableModel(variable: TypedVariableModel): SceneVariable {
  const commonProperties = {
    name: variable.name,
    label: variable.label,
    description: variable.description,
    showInControlsMenu: variable.showInControlsMenu,
  };
  if (variable.type === 'adhoc') {
    const originFilters: AdHocVariableFilter[] = [];
    const filters: AdHocVariableFilter[] = [];
    variable.filters?.forEach((filter) => (filter.origin ? originFilters.push(filter) : filters.push(filter)));

    return new AdHocFiltersVariable({
      ...commonProperties,
      description: variable.description,
      skipUrlSync: variable.skipUrlSync,
      hide: variable.hide,
      datasource: variable.datasource,
      applyMode: 'auto',
      originFilters,
      filters,
      baseFilters: variable.baseFilters ?? [],
      defaultKeys: variable.defaultKeys,
      allowCustomValue: variable.allowCustomValue,
      useQueriesAsFilterForOptions: true,
      layout: config.featureToggles.newFiltersUI ? 'combobox' : undefined,
      supportsMultiValueOperators: Boolean(
        getDataSourceSrv().getInstanceSettings(variable.datasource)?.meta.multiValueFilterOperators
      ),
    });
  }
  if (variable.type === 'custom') {
    return new CustomVariable({
      ...commonProperties,
      value: variable.current?.value ?? '',
      text: variable.current?.text ?? '',

      query: variable.query,
      isMulti: variable.multi,
      allValue: variable.allValue || undefined,
      includeAll: variable.includeAll,
      defaultToAll: Boolean(variable.includeAll),
      skipUrlSync: variable.skipUrlSync,
      hide: variable.hide,
      allowCustomValue: variable.allowCustomValue,
    });
  } else if (variable.type === 'query') {
    return new QueryVariable({
      ...commonProperties,
      value: variable.current?.value ?? '',
      text: variable.current?.text ?? '',

      query: variable.query,
      datasource: variable.datasource,
      sort: variable.sort,
      refresh: variable.refresh,
      regex: variable.regex,
      allValue: variable.allValue || undefined,
      includeAll: variable.includeAll,
      defaultToAll: Boolean(variable.includeAll),
      isMulti: variable.multi,
      skipUrlSync: variable.skipUrlSync,
      hide: variable.hide,
      definition: variable.definition,
      allowCustomValue: variable.allowCustomValue,
      staticOptions: variable.staticOptions?.map((option) => ({
        label: String(option.text),
        value: String(option.value),
      })),
      staticOptionsOrder: variable.staticOptionsOrder,
    });
  } else if (variable.type === 'datasource') {
    return new DataSourceVariable({
      ...commonProperties,
      value: variable.current?.value ?? '',
      text: variable.current?.text ?? '',
      regex: variable.regex,
      pluginId: variable.query,
      allValue: variable.allValue || undefined,
      includeAll: variable.includeAll,
      defaultToAll: Boolean(variable.includeAll),
      skipUrlSync: variable.skipUrlSync,
      isMulti: variable.multi,
      hide: variable.hide,
      defaultOptionEnabled: variable.current?.value === DEFAULT_DATASOURCE && variable.current?.text === 'default',
      allowCustomValue: variable.allowCustomValue,
    });
  } else if (variable.type === 'interval') {
    const intervals = getIntervalsFromQueryString(variable.query);
    const currentInterval = getCurrentValueForOldIntervalModel(variable, intervals);
    return new IntervalVariable({
      ...commonProperties,
      value: currentInterval,
      intervals: intervals,
      autoEnabled: variable.auto,
      autoStepCount: variable.auto_count,
      autoMinInterval: variable.auto_min,
      refresh: variable.refresh,
      skipUrlSync: variable.skipUrlSync,
      hide: variable.hide,
    });
  } else if (variable.type === 'constant') {
    return new ConstantVariable({
      ...commonProperties,
      value: variable.query,
      skipUrlSync: variable.skipUrlSync,
      hide: variable.hide,
    });
  } else if (variable.type === 'textbox') {
    let val;
    if (!variable?.current?.value) {
      val = variable.query;
    } else {
      if (typeof variable.current.value === 'string') {
        val = variable.current.value;
      } else {
        val = variable.current.value[0];
      }
    }

    return new TextBoxVariable({
      ...commonProperties,
      value: val,
      skipUrlSync: variable.skipUrlSync,
      hide: variable.hide,
    });
  } else if (config.featureToggles.groupByVariable && variable.type === 'groupby') {
    return new GroupByVariable({
      ...commonProperties,
      datasource: variable.datasource,
      value: variable.current?.value || [],
      text: variable.current?.text || [],
      skipUrlSync: variable.skipUrlSync,
      hide: variable.hide,
      // @ts-expect-error
      defaultOptions: variable.options,
      defaultValue: variable.defaultValue,
      allowCustomValue: variable.allowCustomValue,
    });
  } else {
    throw new Error(`Scenes: Unsupported variable type ${variable.type}`);
  }
}
