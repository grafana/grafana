import { TypedVariableModel } from '@grafana/data';
import { config, getDataSourceSrv } from '@grafana/runtime';
import {
  AdHocFiltersVariable,
  ConstantVariable,
  CustomVariable,
  DataSourceVariable,
  GroupByVariable,
  IntervalVariable,
  QueryVariable,
  SceneObject,
  SceneVariable,
  SceneVariableSet,
  TextBoxVariable,
} from '@grafana/scenes';
import { getFeatureStatus } from 'app/features/dashboard/services/featureFlagSrv';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';

import { QueryVariableBMC } from '../bmc/variables/QueryVariableBMC';
import { DatePickerVariable } from '../bmc/variables/datepicker/DatePickerVariable';
import { OptimizeVariable } from '../bmc/variables/optimize/OptimizeVariable';
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
  };
  if (variable.type === 'adhoc') {
    return new AdHocFiltersVariable({
      ...commonProperties,
      description: variable.description,
      skipUrlSync: variable.skipUrlSync,
      hide: variable.hide,
      datasource: variable.datasource,
      applyMode: 'auto',
      filters: variable.filters ?? [],
      baseFilters: variable.baseFilters ?? [],
      defaultKeys: variable.defaultKeys,
      // BMC code: allowCustomValue default to false
      allowCustomValue: variable.allowCustomValue ?? false,
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
      // BMC code: allowCustomValue default to false
      allowCustomValue: variable.allowCustomValue ?? false,
    });
  } else if (variable.type === 'query') {
    // BMC Change: Use QueryVariableBMC for BMC specific query variable
    return new QueryVariableBMC({
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
      // BMC code: allowCustomValue default to false
      allowCustomValue: variable.allowCustomValue ?? false,
      // BMC Change: Below all props
      discardForAll: variable.discardForAll,
      bmcVarCache: variable.bmcVarCache,
      // BMC Change: Ends
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
      // BMC code: allowCustomValue default to false
      allowCustomValue: variable.allowCustomValue ?? false,
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
      // BMC code: allowCustomValue default to false
      allowCustomValue: variable.allowCustomValue ?? false,
    });
  }
  // BMC code: Added datepicker and optimize variables support
  else if (variable.type === 'datepicker') {
    return new DatePickerVariable({
      ...commonProperties,
      value: Array.isArray(variable.current?.value)
        ? (variable.current?.value[0] ?? '')
        : (variable.current?.value ?? ''),
      skipUrlSync: variable.skipUrlSync,
      hide: variable.hide,
    });
  } else if (variable.type === 'optimizepicker') {
    // Check feature flag before creating optimize variable
    const optimizeDomainPickerEnabled = getFeatureStatus('opt_domain_picker');
    if (!optimizeDomainPickerEnabled) {
      throw new Error('Optimize variable is not enabled');
    }
    return new OptimizeVariable({
      ...commonProperties,
      value: Array.isArray(variable.current?.value)
        ? variable.current?.value
        : variable.current?.value
          ? [variable.current?.value]
          : [],
      skipUrlSync: variable.skipUrlSync,
      hide: variable.hide,
      filterondescendant: variable.filterondescendant,
    });
  }
  // BMC code: end
  else {
    throw new Error(`Scenes: Unsupported variable type ${variable.type}`);
  }
}

// BMC Change: Next function
export function isVariableSet(variable: SceneObject): variable is SceneVariable {
  return (
    variable instanceof AdHocFiltersVariable ||
    variable instanceof ConstantVariable ||
    variable instanceof CustomVariable ||
    variable instanceof DataSourceVariable ||
    variable instanceof GroupByVariable ||
    variable instanceof IntervalVariable ||
    variable instanceof QueryVariable ||
    variable instanceof DatePickerVariable ||
    variable instanceof OptimizeVariable ||
    variable instanceof TextBoxVariable
  );
}
