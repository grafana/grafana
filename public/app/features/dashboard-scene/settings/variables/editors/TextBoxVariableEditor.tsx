import { noop } from 'lodash';
import { type FormEvent } from 'react';

import { t } from '@grafana/i18n';
import { type SceneVariable, TextBoxVariable } from '@grafana/scenes';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { undoableVariableEdit } from '../../../actions/variable/undoableVariableEdit';
import { TextBoxVariableForm } from '../components/TextBoxVariableForm';

interface TextBoxVariableEditorProps {
  variable: TextBoxVariable;
  onChange: (variable: TextBoxVariable) => void;
  inline?: boolean;
}

export function TextBoxVariableEditor({ variable, inline }: TextBoxVariableEditorProps) {
  const { value } = variable.useState();

  const onTextValueChange = (e: FormEvent<HTMLInputElement>) => {
    const newValue = e.currentTarget.value;
    const oldValue = variable.state.value;

    undoableVariableEdit(inline && newValue !== oldValue, {
      meta: { actionId: 'variable.changeValue', scope: 'textbox' },
      source: variable,
      description: t('dashboard.edit-actions.variable-textbox-value', 'Change variable value'),
      perform: () => variable.setState({ value: newValue }),
      undo: () => variable.setState({ value: oldValue }),
    });
  };

  // The input is uncontrolled, remount it when the value changes outside of it (e.g. undo/redo)
  return <TextBoxVariableForm key={value} defaultValue={value} onBlur={onTextValueChange} inline={inline} />;
}

export function getTextBoxVariableOptions(variable: SceneVariable): OptionsPaneItemDescriptor[] {
  if (!(variable instanceof TextBoxVariable)) {
    console.warn('getTextBoxVariableOptions: variable is not a TextBoxVariable');
    return [];
  }

  return [
    new OptionsPaneItemDescriptor({
      title: t('dashboard-scene.textbox-variable-form.label-value', 'Value'),
      id: `variable-${variable.state.name}-value`,
      render: () => <TextBoxVariableEditor onChange={noop} variable={variable} inline={true} />,
    }),
  ];
}
