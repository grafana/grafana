import { type SceneVariable } from '@grafana/scenes';
import { type OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { getEditableVariablesMetadata } from './editableVariablesMetadata';
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
import { type EditableVariableType } from './utils';

export interface EditableVariableConfig {
  name: string;
  description: string;
  editor: React.ComponentType<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  getOptions?: (variable: SceneVariable) => OptionsPaneItemDescriptor[];
}

/**
 * The full editor registry pulls in every variable editor (and their option forms).
 * Only import this module from edit-time code paths, ideally through a dynamic
 * import, so the editors stay out of the initial dashboard bundle. View-mode code
 * that only needs type names/descriptions should use `editableVariablesMetadata.ts`.
 */
export const getEditableVariables: () => Record<EditableVariableType, EditableVariableConfig> = () => {
  const metadata = getEditableVariablesMetadata();

  return {
    custom: {
      ...metadata.custom,
      editor: CustomVariableEditor,
      getOptions: getCustomVariableOptions,
    },
    query: {
      ...metadata.query,
      editor: QueryVariableEditor,
      getOptions: getQueryVariableOptions,
    },
    constant: {
      ...metadata.constant,
      editor: ConstantVariableEditor,
      getOptions: getConstantVariableOptions,
    },
    interval: {
      ...metadata.interval,
      editor: IntervalVariableEditor,
      getOptions: getIntervalVariableOptions,
    },
    datasource: {
      ...metadata.datasource,
      editor: DataSourceVariableEditor,
      getOptions: getDataSourceVariableOptions,
    },
    adhoc: {
      ...metadata.adhoc,
      editor: AdHocFiltersVariableEditor,
      getOptions: getAdHocFilterOptions,
    },
    groupby: {
      ...metadata.groupby,
      editor: GroupByVariableEditor,
      getOptions: getGroupByVariableOptions,
    },
    textbox: {
      ...metadata.textbox,
      editor: TextBoxVariableEditor,
      getOptions: getTextBoxVariableOptions,
    },
    switch: {
      ...metadata.switch,
      editor: SwitchVariableEditor,
      getOptions: getSwitchVariableOptions,
    },
  };
};

export function getEditableVariableDefinition(type: string): EditableVariableConfig {
  const editableVariables = getEditableVariables();
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const editableVariable = editableVariables[type as EditableVariableType];
  if (!editableVariable) {
    throw new Error(`Variable type ${type} not found`);
  }

  return editableVariable;
}

export function getVariableEditor(type: EditableVariableType) {
  const editableVariables = getEditableVariables();
  return editableVariables[type].editor;
}
