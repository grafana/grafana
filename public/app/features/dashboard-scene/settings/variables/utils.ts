import { chain } from 'lodash';
import { firstValueFrom } from 'rxjs';

import { DataSourceInstanceSettings, SelectableValue, TypedVariableModel } from '@grafana/data';
import { config, getBackendSrv, getDataSourceSrv, getTemplateSrv } from '@grafana/runtime';
import { safeStringifyValue } from 'app/core/utils/explore';
import {
  AdHocFiltersVariable,
  ConstantVariable,
  CustomVariable,
  DataSourceVariable,
  GroupByVariable,
  IntervalVariable,
  MultiValueVariable,
  QueryVariable,
  SceneObject,
  sceneUtils,
  SceneVariable,
  SceneVariableState,
  TextBoxVariable,
} from '@grafana/scenes';
import { VariableHide, VariableType } from '@grafana/schema';
import { getFeatureStatus } from 'app/features/dashboard/services/featureFlagSrv';

import { QueryVariableBMC } from '../../bmc/variables/QueryVariableBMC';
import { DatePickerVariable } from '../../bmc/variables/datepicker/DatePickerVariable';
import { OptimizeVariable } from '../../bmc/variables/optimize/OptimizeVariable';
import { getIntervalsQueryFromNewIntervalModel } from '../../utils/utils';

import { AdHocFiltersVariableEditor } from './editors/AdHocFiltersVariableEditor';
import { ConstantVariableEditor } from './editors/ConstantVariableEditor';
import { CustomVariableEditor } from './editors/CustomVariableEditor';
import { DataSourceVariableEditor } from './editors/DataSourceVariableEditor';
import { DatePickerVariableEditor } from './editors/DatePickerVariableEditor';
import { GroupByVariableEditor } from './editors/GroupByVariableEditor';
import { IntervalVariableEditor } from './editors/IntervalVariableEditor';
import { OptimizeVariableEditor } from './editors/OptimizeVariableEditor';
import { QueryVariableEditor } from './editors/QueryVariableEditor';
import { TextBoxVariableEditor } from './editors/TextBoxVariableEditor';

interface EditableVariableConfig {
  name: string;
  description: string;
  editor: React.ComponentType<any>;
}

//exclude system variable type and snapshot variable type
export type EditableVariableType = Exclude<VariableType, 'system' | 'snapshot'>;

export function isEditableVariableType(type: VariableType): type is EditableVariableType {
  return type !== 'system';
}

export const EDITABLE_VARIABLES: Record<EditableVariableType, EditableVariableConfig> = {
  custom: {
    name: 'Custom',
    description: 'Define variable values manually',
    editor: CustomVariableEditor,
  },
  query: {
    name: 'Query',
    description: 'Variable values are fetched from a datasource query',
    editor: QueryVariableEditor,
  },
  constant: {
    name: 'Constant',
    description: 'Define a hidden constant variable, useful for metric prefixes in dashboards you want to share',
    editor: ConstantVariableEditor,
  },
  interval: {
    name: 'Interval',
    description: 'Define a timespan interval (ex 1m, 1h, 1d)',
    editor: IntervalVariableEditor,
  },
  datasource: {
    name: 'Data source',
    description: 'Enables you to dynamically switch the data source for multiple panels',
    editor: DataSourceVariableEditor,
  },
  adhoc: {
    name: 'Ad hoc filters',
    description: 'Add key/value filters on the fly',
    editor: AdHocFiltersVariableEditor,
  },
  groupby: {
    name: 'Group by',
    description: 'Add keys to group by on the fly',
    editor: GroupByVariableEditor,
  },
  textbox: {
    name: 'Textbox',
    description: 'Define a textbox variable, where users can enter any arbitrary string',
    editor: TextBoxVariableEditor,
  },
  // BMC code - register datepicker and optimize variables
  datepicker: {
    name: 'Date Range',
    description: 'Define a date range variable where users can select any date range',
    editor: DatePickerVariableEditor,
  },
  optimizepicker: {
    name: 'Optimize variable',
    description: 'Define an optimize variable, where users can select optimize query types',
    editor: OptimizeVariableEditor,
  },
  // BMC code: end
};

// BMC code: Conditionally delete optimizepicker variable
const optimizeDomainPickerEnabled = getFeatureStatus('opt_domain_picker');

if (!optimizeDomainPickerEnabled) {
  delete (EDITABLE_VARIABLES as Partial<typeof EDITABLE_VARIABLES>).optimizepicker;
}
// BMC code: end

export const EDITABLE_VARIABLES_SELECT_ORDER: EditableVariableType[] = [
  'query',
  'custom',
  'textbox',
  'constant',
  'datasource',
  'interval',
  'adhoc',
  'groupby',
  // BMC code: Added datepicker variable type
  'datepicker',
];

// BMC code: Conditionally add optimize variable type
if (optimizeDomainPickerEnabled) {
  EDITABLE_VARIABLES_SELECT_ORDER.push('optimizepicker');
}
// BMC code: end

export function getVariableTypeSelectOptions(): Array<SelectableValue<EditableVariableType>> {
  const results = EDITABLE_VARIABLES_SELECT_ORDER.map((variableType) => ({
    label: EDITABLE_VARIABLES[variableType].name,
    value: variableType,
    description: EDITABLE_VARIABLES[variableType].description,
  }));

  if (!config.featureToggles.groupByVariable) {
    // Remove group by variable type if feature toggle is off
    return results.filter((option) => option.value !== 'groupby');
  }

  return results;
}

export function getVariableEditor(type: EditableVariableType) {
  return EDITABLE_VARIABLES[type].editor;
}

interface CommonVariableProperties {
  name: string;
  label?: string;
}

export function getVariableScene(type: EditableVariableType, initialState: CommonVariableProperties) {
  switch (type) {
    case 'custom':
      return new CustomVariable(initialState);
    case 'query':
      // BMC Change: Use QueryVariableBMC for BMC specific query variable
      return new QueryVariableBMC({ ...initialState, bmcVarCache: false });
    case 'constant':
      return new ConstantVariable({ ...initialState, hide: VariableHide.hideVariable });
    case 'interval':
      return new IntervalVariable(initialState);
    case 'datasource':
      return new DataSourceVariable(initialState);
    case 'adhoc':
      return new AdHocFiltersVariable({
        ...initialState,
        layout: config.featureToggles.newFiltersUI ? 'combobox' : undefined,
      });
    case 'groupby':
      return new GroupByVariable(initialState);
    case 'textbox':
      return new TextBoxVariable(initialState);
    // BMC code - next cases for datepicker and optimize variable
    case 'datepicker':
      return new DatePickerVariable({
        ...initialState,
      });
    case 'optimizepicker':
      // Check feature flag before creating optimize variable
      if (!optimizeDomainPickerEnabled) {
        throw new Error('Optimize variable is not enabled');
      }
      return new OptimizeVariable({
        ...initialState,
      });
    // BMC code: end
  }
}

export function getVariableDefault(variables: Array<SceneVariable<SceneVariableState>>) {
  const defaultVariableType = 'query';
  const nextVariableIdName = getNextAvailableId(defaultVariableType, variables);
  // BMC Change: Use QueryVariableBMC for BMC specific query variable
  return new QueryVariableBMC({
    name: nextVariableIdName,
    bmcVarCache: false,
  });
}

export function getNextAvailableId(type: VariableType, variables: Array<SceneVariable<SceneVariableState>>): string {
  let counter = 0;
  let nextId = `${type}${counter}`;

  while (variables.find((variable) => variable.state.name === nextId)) {
    nextId = `${type}${++counter}`;
  }

  return nextId;
}

export function hasVariableOptions(variable: SceneVariable): variable is MultiValueVariable {
  // variable options can be defined by state.options or state.intervals in case of interval variable
  return 'options' in variable.state || 'intervals' in variable.state;
}

export function getDefinition(model: SceneVariable): string {
  let definition = '';

  if (model instanceof QueryVariable) {
    definition = model.state.definition || (typeof model.state.query === 'string' ? model.state.query : '');
  } else if (model instanceof DataSourceVariable) {
    definition = String(model.state.pluginId);
  } else if (model instanceof CustomVariable) {
    definition = model.state.query;
  } else if (model instanceof IntervalVariable) {
    definition = getIntervalsQueryFromNewIntervalModel(model.state.intervals);
  } else if (
    model instanceof TextBoxVariable ||
    model instanceof ConstantVariable ||
    // BMC code - include datepicker variable in definition
    model instanceof DatePickerVariable
  ) {
    definition = String(model.state.value);
  }

  return definition;
}

export function getOptionDataSourceTypes() {
  const datasources = getDataSourceSrv().getList({ metrics: true, variables: true });

  const optionTypes = chain(datasources)
    .uniqBy('meta.id')
    .map((ds: DataSourceInstanceSettings) => {
      return { label: ds.meta.name, value: ds.meta.id };
    })
    .value();

  optionTypes.unshift({ label: '', value: '' });

  return optionTypes;
}

function isSceneVariable(sceneObject: SceneObject): sceneObject is SceneVariable {
  return 'type' in sceneObject.state && 'getValue' in sceneObject;
}

// BMC code: Added datepicker and optimize variables check
export function isDateRangeVariable(variable: SceneVariable): boolean {
  return variable.state.type === 'datepicker';
}

export function isOptimizeVariable(variable: SceneVariable): boolean {
  return variable.state.type === 'optimizepicker';
}
// BMC code: end

export function isSceneVariableInstance(sceneObject: SceneObject): sceneObject is SceneVariable {
  if (!isSceneVariable(sceneObject)) {
    return false;
  }

  return (
    sceneUtils.isAdHocVariable(sceneObject) ||
    sceneUtils.isConstantVariable(sceneObject) ||
    sceneUtils.isCustomVariable(sceneObject) ||
    sceneUtils.isDataSourceVariable(sceneObject) ||
    sceneUtils.isIntervalVariable(sceneObject) ||
    sceneUtils.isQueryVariable(sceneObject) ||
    sceneUtils.isTextBoxVariable(sceneObject) ||
    sceneUtils.isGroupByVariable(sceneObject) ||
    // BMC code - check for datepicker and optimize variables
    isDateRangeVariable(sceneObject) ||
    isOptimizeVariable(sceneObject)
  );
}

export const RESERVED_GLOBAL_VARIABLE_NAME_REGEX = /^(?!__).*$/;
export const WORD_CHARACTERS_REGEX = /^\w+$/;

// BMC code starts
/**
 Returns true if the variable query DIRECTLY contains time range variables (non-recursive)
  
 Used to determine if caching should be disabled for the variable itself.
 Variables that depend on time range should not be cached because they change with dashboard time range.
  
 1. Use regex to find all variable references in the query (e.g., $var, [[var]], ${var})
 2. Extract variable names from matches
 3 Check if any variable name is a time-range-dependent variable
  
 EXAMPLES:
 Query: "SELECT * FROM metrics WHERE time > $__from AND time < $__to"
 Variables found: ["$__from", "$__to"]
 Extracted names: ["__from", "__to"]
 Result: true (both are in timeRangeVariables set)
 */

export const variableRegex = /\$(\w+)|\[\[(\w+?)(?::(\w+))?\]\]|\${(\w+)(?:\.([^:^\}]+))?(?::([^\}]+))?}/g;

export const containsDirectTimeRangeVariables = (variableQuery: string): boolean => {
  const variableQueryString = typeof variableQuery === 'string' ? variableQuery : safeStringifyValue(variableQuery);

  // Use variableRegex to find all variable references in the query
  // variableRegex matches: $varName, [[varName]], ${varName}
  const matches = variableQueryString.match(variableRegex);
  if (!matches || matches.length === 0) {
    return false; // no variable found
  }

  // List of time range variables
  const timeRangeVariables = new Set<string>([
    '__from',
    '__to',
    '__timeFilter',
    '__interval',
    '__interval_ms',
    '__range',
    '__range_ms',
    '__range_s',
    '__timezone',
    '__rate_interval',
    '__rate_interval_ms',
  ]);

  for (const match of matches) {
    let varName = '';

    // Extract the variable name from the match
    // variableRegex has capture groups: [1] for $var, [2] for [[var]], [4] for ${var}
    // Example: "$__from" -> varName = "__from"
    // Example: "[[region]]" -> varName = "region"
    // Example: "${interval}" -> varName = "interval"
    const varMatch = variableRegex.exec(match);
    if (varMatch) {
      varName = varMatch[1] || varMatch[2] || varMatch[4] || '';
    }

    // If present in time range list, return true
    if (timeRangeVariables.has(varName)) {
      return true;
    }

    // Check if it's a datepicker or interval variable (direct time-range variables)
    const allVariables = getTemplateSrv().getVariables();
    const variable = allVariables.find((v: any) => v.name === varName);
    if (variable && (variable.type === 'datepicker' || variable.type === 'interval')) {
      return true;
    }
  }

  return false;
};

// Returns true if the query is of service management query type
export const isServiceManagementQuery = (variableQuery: string | object): boolean => {
  if (typeof variableQuery === 'string') {
    return variableQuery.startsWith('remedy,');
  } else if (typeof variableQuery === 'object') {
    return (variableQuery as any)?.sourceType === 'remedy';
  }
  return false;
};

// Performs checks like isServiceManagementQuery, bmcCache enabled and deletes the variable cache
export const deleteVariableCache = async (
  variable: TypedVariableModel | QueryVariable['state'],
  dashboardUID: string,
  deleteVariableCacheForAllUsers: boolean
): Promise<boolean> => {
  if (!variable || variable.type !== 'query') {
    return false;
  }

  if (!isServiceManagementQuery(variable?.query || '')) {
    console.log('can only delete cache for service management queries');
    return false;
  }

  if (!!!variable.name || !!!dashboardUID) {
    console.error('Variable name or dashboardUID is invalid for deletion');
    return false;
  }
  // @ts-expect-error
  if (variable?.bmcVarCache !== true) {
    return false;
  }

  try {
    const response = getBackendSrv().fetch({
      url: `/api/bmc/dashboard/${dashboardUID}/variable/cache`,
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'x-bhd-variable-name': variable.name,
        'x-bhd-variable-changed': deleteVariableCacheForAllUsers,
      },
    });
    const cacheDeleteResponse = await firstValueFrom(response);
    if (!cacheDeleteResponse.ok) {
      console.error(`Redis cache deletion failed with status: ${cacheDeleteResponse.status}`);
    }

    return true;
  } catch (deleteErr) {
    console.error('Error during Redis cache deletion:', deleteErr);
  }
  return false;
};

// BMC code: end
