import { chain } from 'lodash';

import { DataSourceInstanceSettings, SelectableValue } from '@grafana/data';
import { config, getDataSourceSrv } from '@grafana/runtime';
import {
  ConstantVariable,
  CustomVariable,
  DataSourceVariable,
  IntervalVariable,
  TextBoxVariable,
  QueryVariable,
  GroupByVariable,
  SceneVariable,
  MultiValueVariable,
  sceneUtils,
  SceneObject,
  AdHocFiltersVariable,
  SceneVariableState,
} from '@grafana/scenes';
import { VariableHide, VariableType } from '@grafana/schema';

import { getIntervalsQueryFromNewIntervalModel } from '../../utils/utils';

import { AdHocFiltersVariableEditor } from './editors/AdHocFiltersVariableEditor';
import { ConstantVariableEditor } from './editors/ConstantVariableEditor';
import { CustomVariableEditor } from './editors/CustomVariableEditor';
import { DataSourceVariableEditor } from './editors/DataSourceVariableEditor';
import { GroupByVariableEditor } from './editors/GroupByVariableEditor';
import { IntervalVariableEditor } from './editors/IntervalVariableEditor';
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
};

export const EDITABLE_VARIABLES_SELECT_ORDER: EditableVariableType[] = [
  'query',
  'custom',
  'textbox',
  'constant',
  'datasource',
  'interval',
  'adhoc',
  'groupby',
];

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
      return new QueryVariable(initialState);
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
  }
}

export function getVariableDefault(variables: Array<SceneVariable<SceneVariableState>>) {
  const defaultVariableType = 'query';
  const nextVariableIdName = getNextAvailableId(defaultVariableType, variables);
  return new QueryVariable({
    name: nextVariableIdName,
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
  } else if (model instanceof TextBoxVariable || model instanceof ConstantVariable) {
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
    sceneUtils.isGroupByVariable(sceneObject)
  );
}

export const RESERVED_GLOBAL_VARIABLE_NAME_REGEX = /^(?!__).*$/;
export const WORD_CHARACTERS_REGEX = /^\w+$/;
