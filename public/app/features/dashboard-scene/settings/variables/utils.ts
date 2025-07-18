import { chain } from 'lodash';

import { DataSourceInstanceSettings, SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
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
  SceneVariableSet,
} from '@grafana/scenes';
import { VariableHide, VariableType } from '@grafana/schema';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { getIntervalsQueryFromNewIntervalModel } from '../../utils/utils';

import { AdHocFiltersVariableEditor, getAdHocFilterOptions } from './editors/AdHocFiltersVariableEditor';
import { ConstantVariableEditor, getConstantVariableOptions } from './editors/ConstantVariableEditor';
import { CustomVariableEditor, getCustomVariableOptions } from './editors/CustomVariableEditor';
import { DataSourceVariableEditor, getDataSourceVariableOptions } from './editors/DataSourceVariableEditor';
import { getGroupByVariableOptions, GroupByVariableEditor } from './editors/GroupByVariableEditor';
import { getIntervalVariableOptions, IntervalVariableEditor } from './editors/IntervalVariableEditor';
import { getQueryVariableOptions, QueryVariableEditor } from './editors/QueryVariableEditor';
import { TextBoxVariableEditor, getTextBoxVariableOptions } from './editors/TextBoxVariableEditor';

interface EditableVariableConfig {
  name: string;
  description: string;
  editor: React.ComponentType<any>;
  getOptions?: (variable: SceneVariable) => OptionsPaneItemDescriptor[];
}

//exclude system variable type and snapshot variable type
export type EditableVariableType = Exclude<VariableType, 'system' | 'snapshot'>;

export function isEditableVariableType(type: VariableType): type is EditableVariableType {
  return type !== 'system';
}

export const getEditableVariables: () => Record<EditableVariableType, EditableVariableConfig> = () => ({
  custom: {
    name: t('dashboard-scene.get-editable-variables.name.custom', 'Custom'),
    description: t(
      'dashboard-scene.get-editable-variables.description.values-are-static-and-defined-manually',
      'Values are static and defined manually'
    ),
    editor: CustomVariableEditor,
    getOptions: getCustomVariableOptions,
  },
  query: {
    name: t('dashboard-scene.get-editable-variables.name.query', 'Query'),
    description: t(
      'dashboard-scene.get-editable-variables.description.values-fetched-source-query',
      'Values are fetched from a data source query'
    ),
    editor: QueryVariableEditor,
    getOptions: getQueryVariableOptions,
  },
  constant: {
    name: t('dashboard-scene.get-editable-variables.name.constant', 'Constant'),
    description: t(
      'dashboard-scene.get-editable-variables.description.hidden-constant-variable',
      'A hidden constant variable, useful for metric prefixes in dashboards you want to share'
    ),
    editor: ConstantVariableEditor,
    getOptions: getConstantVariableOptions,
  },
  interval: {
    name: t('dashboard-scene.get-editable-variables.name.interval', 'Interval'),
    description: t(
      'dashboard-scene.get-editable-variables.description.values-timespans',
      'Values are timespans, ex 1m, 1h, 1d'
    ),
    editor: IntervalVariableEditor,
    getOptions: getIntervalVariableOptions,
  },
  datasource: {
    name: t('dashboard-scene.get-editable-variables.name.data-source', 'Data source'),
    description: t(
      'dashboard-scene.get-editable-variables.description.dynamically-switch-source-multiple-panels',
      'Dynamically switch the data source for multiple panels'
    ),
    editor: DataSourceVariableEditor,
    getOptions: getDataSourceVariableOptions,
  },
  adhoc: {
    name: t('dashboard-scene.get-editable-variables.name.ad-hoc-filters', 'Ad hoc filters'),
    description: t(
      'dashboard-scene.get-editable-variables.description.add-keyvalue-filters-on-the-fly',
      'Add key/value filters on the fly'
    ),
    editor: AdHocFiltersVariableEditor,
    getOptions: getAdHocFilterOptions,
  },
  groupby: {
    name: t('dashboard-scene.get-editable-variables.name.group-by', 'Group by'),
    description: t('dashboard-scene.get-editable-variables.description.group', 'Add keys to group by on the fly'),
    editor: GroupByVariableEditor,
    getOptions: getGroupByVariableOptions,
  },
  textbox: {
    name: t('dashboard-scene.get-editable-variables.name.textbox', 'Textbox'),
    description: t(
      'dashboard-scene.get-editable-variables.description.users-enter-arbitrary-strings-textbox',
      'Users can enter any arbitrary strings in a textbox'
    ),
    editor: TextBoxVariableEditor,
    getOptions: getTextBoxVariableOptions,
  },
});

export function getEditableVariableDefinition(type: string): EditableVariableConfig {
  const editableVariables = getEditableVariables();
  const editableVariable = editableVariables[type as EditableVariableType];
  if (!editableVariable) {
    throw new Error(`Variable type ${type} not found`);
  }

  return editableVariable;
}

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
  const editableVariables = getEditableVariables();
  const results = EDITABLE_VARIABLES_SELECT_ORDER.map((variableType) => ({
    label: editableVariables[variableType].name,
    value: variableType,
    description: editableVariables[variableType].description,
  }));

  if (!config.featureToggles.groupByVariable) {
    // Remove group by variable type if feature toggle is off
    return results.filter((option) => option.value !== 'groupby');
  }

  return results;
}

export function getVariableEditor(type: EditableVariableType) {
  const editableVariables = getEditableVariables();
  return editableVariables[type].editor;
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

  return optionTypes;
}

export function isSceneVariable(sceneObject: SceneObject): sceneObject is SceneVariable {
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

export function validateVariableName(
  variable: SceneVariable,
  name: string
): { isValid: boolean; errorMessage?: string } {
  const set = variable.parent;
  if (!(set instanceof SceneVariableSet)) {
    throw new Error('Variable parent is not a SceneVariableSet');
  }

  if (!RESERVED_GLOBAL_VARIABLE_NAME_REGEX.test(name)) {
    return {
      isValid: false,
      errorMessage: "Template names cannot begin with '__', that's reserved for Grafana's global variables",
    };
  }

  if (!WORD_CHARACTERS_REGEX.test(name)) {
    return { isValid: false, errorMessage: 'Only word characters are allowed in variable names' };
  }

  const varLookupByName = set.getByName(name);

  if (varLookupByName && varLookupByName !== variable) {
    return { isValid: false, errorMessage: 'Variable with the same name already exists' };
  }

  return { isValid: true };
}
