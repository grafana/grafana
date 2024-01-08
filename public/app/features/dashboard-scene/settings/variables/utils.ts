import { SelectableValue } from '@grafana/data';
import {
  AdHocFiltersVariable,
  ConstantVariable,
  CustomVariable,
  DataSourceVariable,
  IntervalVariable,
  TextBoxVariable,
  QueryVariable,
} from '@grafana/scenes';
import { VariableType } from '@grafana/schema';

import { AdHocFiltersVariableEditor } from './editors/AdHocFiltersVariableEditor';
import { ConstantVariableEditor } from './editors/ConstantVariableEditor';
import { CustomVariableEditor } from './editors/CustomVariableEditor';
import { DataSourceVariableEditor } from './editors/DataSourceVariableEditor';
import { IntervalVariableEditor } from './editors/IntervalVariableEditor';
import { QueryVariableEditor } from './editors/QueryVariableEditor';
import { TextBoxVariableEditor } from './editors/TextBoxVariableEditor';

interface EditableVariableConfig {
  name: string;
  description: string;
  // FIXME: This should include all the scene objects
  scene:
    | typeof CustomVariable
    | typeof QueryVariable
    | typeof ConstantVariable
    | typeof IntervalVariable
    | typeof DataSourceVariable
    | typeof AdHocFiltersVariable
    | typeof TextBoxVariable;
  // FIXME: This should include all the editor objects
  editor: React.ComponentType<any>;
}

export type EditableVariableType = Exclude<VariableType, 'system'>;

export function isEditableVariableType(type: VariableType): type is EditableVariableType {
  return type !== 'system';
}

const EDITABLE_VARIABLES: Record<EditableVariableType, EditableVariableConfig> = {
  custom: {
    name: 'Custom',
    description: 'Custom variables',
    scene: CustomVariable,
    editor: CustomVariableEditor,
  },
  query: {
    name: 'Query',
    description: 'Query variables',
    scene: QueryVariable,
    editor: QueryVariableEditor,
  },
  constant: {
    name: 'Constant',
    description: 'Constant variables',
    scene: ConstantVariable,
    editor: ConstantVariableEditor,
  },
  interval: {
    name: 'Interval',
    description: 'Interval variables',
    scene: IntervalVariable,
    editor: IntervalVariableEditor,
  },
  datasource: {
    name: 'Datasource',
    description: 'Datasource variables',
    scene: DataSourceVariable,
    editor: DataSourceVariableEditor,
  },
  adhoc: {
    name: 'Adhoc',
    description: 'Adhoc variables',
    scene: AdHocFiltersVariable,
    editor: AdHocFiltersVariableEditor,
  },
  textbox: {
    name: 'Textbox',
    description: 'Textbox variables',
    scene: TextBoxVariable,
    editor: TextBoxVariableEditor,
  },
};

export function getVariableTypeSelectOptions(): SelectableValue<VariableType> {
  return Object.entries(EDITABLE_VARIABLES).map(([id, variableType]) => ({
    label: variableType.name,
    value: id,
    description: variableType.description,
  }));
}

export function getVariableEditor(type: EditableVariableType) {
  return EDITABLE_VARIABLES[type]?.editor;
}

export function getVariableScene(type: EditableVariableType) {
  return EDITABLE_VARIABLES[type].scene;
}
