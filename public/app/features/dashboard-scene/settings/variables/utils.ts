import { chain } from 'lodash';

import { type DataSourceInstanceSettings, getDataSourceRef, type SelectableValue } from '@grafana/data';
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
  type SceneVariable,
  type MultiValueVariable,
  sceneUtils,
  type SceneObject,
  AdHocFiltersVariable,
  type SceneVariableState,
  SceneVariableSet,
  SwitchVariable,
} from '@grafana/scenes';
import { type DataSourceRef, VariableHide, type VariableType } from '@grafana/schema';
import { type OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { getIntervalsQueryFromNewIntervalModel } from '../../utils/utils';

import { AdHocFiltersVariableEditor, getAdHocFilterOptions } from './editors/AdHocFiltersVariableEditor';
import { ConstantVariableEditor, getConstantVariableOptions } from './editors/ConstantVariableEditor';
import { CustomVariableEditor } from './editors/CustomVariableEditor/CustomVariableEditor';
import { getCustomVariableOptions } from './editors/CustomVariableEditor/getCustomVariableOptions';
import { DataSourceVariableEditor, getDataSourceVariableOptions } from './editors/DataSourceVariableEditor';
import { getGroupByVariableOptions, GroupByVariableEditor } from './editors/GroupByVariableEditor';
import { getIntervalVariableOptions, IntervalVariableEditor } from './editors/IntervalVariableEditor';
import { QueryVariableEditor } from './editors/QueryVariableEditor/QueryVariableEditor';
import { getQueryVariableOptions } from './editors/QueryVariableEditor/getQueryVariableOptions';
import { getSwitchVariableOptions, SwitchVariableEditor } from './editors/SwitchVariableEditor';
import { TextBoxVariableEditor, getTextBoxVariableOptions } from './editors/TextBoxVariableEditor';

interface EditableVariableConfig {
  name: string;
  description: string;
  editor: React.ComponentType<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  getOptions?: (variable: SceneVariable) => OptionsPaneItemDescriptor[];
}

//exclude system variable type and snapshot variable type
export type EditableVariableType = Exclude<VariableType, 'system' | 'snapshot'>;

export function isEditableVariableType(type: VariableType): type is EditableVariableType {
  return type !== 'system' && type !== 'snapshot';
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
    name: t('dashboard-scene.get-editable-variables.name.ad-hoc-filters', 'Filter'),
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
  switch: {
    name: t('dashboard-scene.get-editable-variables.name.switch', 'Switch'),
    description: t(
      'dashboard-scene.get-editable-variables.description.users-enter-arbitrary-strings-switch',
      'A variable that can be toggled on and off'
    ),
    editor: SwitchVariableEditor,
    getOptions: getSwitchVariableOptions,
  },
});

export function getEditableVariableDefinition(type: string): EditableVariableConfig {
  const editableVariables = getEditableVariables();
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
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
  'switch',
  'groupby',
];

export function getVariableTypeSelectOptions(): Array<SelectableValue<EditableVariableType>> {
  const editableVariables = getEditableVariables();
  const results = EDITABLE_VARIABLES_SELECT_ORDER.map((variableType) => ({
    label: editableVariables[variableType].name,
    value: variableType,
    description: editableVariables[variableType].description,
  }));

  return results.filter((option) => {
    if (!config.featureToggles.groupByVariable && option.value === 'groupby') {
      return false;
    }
    if (config.featureToggles.dashboardUnifiedDrilldownControls && option.value === 'adhoc') {
      return false;
    }

    return true;
  });
}

export function getVariableEditor(type: EditableVariableType) {
  const editableVariables = getEditableVariables();
  return editableVariables[type].editor;
}

export interface CommonVariableProperties {
  name: string;
  label?: string;
  key?: string;
}

function getDefaultDatasourceRef(): DataSourceRef | undefined {
  const defaultDs = getDataSourceSrv().getInstanceSettings(null);
  return defaultDs ? getDataSourceRef(defaultDs) : undefined;
}

export function getVariableScene(type: EditableVariableType, initialState: CommonVariableProperties) {
  switch (type) {
    case 'custom':
      return new CustomVariable(initialState);
    case 'query': {
      // we need to initialize the query variable with the default datasource
      // this matches the behavior in Settings -> Variables -> Add Variable
      // otherwise v2 transformer to save model will treat the variable as auto-assigned and
      // not include it in the save model
      const datasource = getDefaultDatasourceRef();
      return new QueryVariable({ ...initialState, ...(datasource && { datasource }) });
    }
    case 'constant':
      return new ConstantVariable({ ...initialState, hide: VariableHide.hideVariable });
    case 'interval':
      return new IntervalVariable(initialState);
    case 'datasource':
      return new DataSourceVariable(initialState);
    case 'adhoc':
      return new AdHocFiltersVariable({
        ...initialState,
      });
    case 'groupby':
      return new GroupByVariable(initialState);
    case 'textbox':
      return new TextBoxVariable(initialState);
    case 'switch':
      return new SwitchVariable(initialState);
  }
}

export function getVariableDefault(variables: Array<SceneVariable<SceneVariableState>>) {
  const nextVariableIdName = getNextAvailableId('query', variables);
  return getVariableScene('query', { name: nextVariableIdName });
}

export function getVariableNamePrefix(type: EditableVariableType): string {
  return type === 'adhoc' ? 'filter' : type;
}

export function getNextAvailableId(
  type: VariableType | string,
  variables: Array<SceneVariable<SceneVariableState>>
): string {
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
    sceneUtils.isGroupByVariable(sceneObject) ||
    sceneUtils.isSwitchVariable(sceneObject)
  );
}

export const RESERVED_GLOBAL_VARIABLE_NAME_REGEX = /^(?!__).*$/;
export const WORD_CHARACTERS_REGEX = /^\w+$/;

export interface VariableNameValidationResult {
  isValid: boolean;
  errorMessage?: string;
  warningMessage?: string;
}

export function validateVariableName(variable: SceneVariable, name: string): VariableNameValidationResult {
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

  // Check ancestor variable sets — section variable shadows a dashboard-level variable
  let ancestor: SceneObject | undefined = set.parent;
  while (ancestor) {
    const ancestorVars = ancestor.state.$variables;
    if (ancestorVars instanceof SceneVariableSet && ancestorVars !== set) {
      const ancestorVar = ancestorVars.getByName(name);
      if (ancestorVar) {
        return {
          isValid: true,
          warningMessage:
            'A variable with this name already exists at the dashboard level. This variable will overwrite it.',
        };
      }
    }
    ancestor = ancestor.parent;
  }

  // Check descendant variable sets — dashboard variable collides with a section variable
  if (set.parent) {
    const conflict = findNameInDescendantSets(set.parent, name, set);
    if (conflict) {
      return {
        isValid: true,
        warningMessage:
          'A variable with this name already exists in a section. This variable will be ignored in that section.',
      };
    }
  }

  return { isValid: true };
}

function findNameInDescendantSets(sceneObject: SceneObject, name: string, excludeSet: SceneVariableSet): boolean {
  let found = false;
  sceneObject.forEachChild((child) => {
    if (found) {
      return;
    }
    const childVars = child.state.$variables;
    if (childVars instanceof SceneVariableSet && childVars !== excludeSet && childVars.getByName(name)) {
      found = true;
      return;
    }
    if (findNameInDescendantSets(child, name, excludeSet)) {
      found = true;
    }
  });
  return found;
}

export function isVariableEditable(variable: SceneVariable) {
  return variable.state.type !== 'system' && variable.state.origin === undefined;
}
