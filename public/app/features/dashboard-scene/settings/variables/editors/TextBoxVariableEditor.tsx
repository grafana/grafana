import { FormEvent } from 'react';

import { SceneVariable, TextBoxVariable } from '@grafana/scenes';

import { TextBoxVariableForm } from '../components/TextBoxVariableForm';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';
import { t } from 'i18next';
import { noop } from 'lodash';

interface TextBoxVariableEditorProps {
  variable: TextBoxVariable;
  onChange: (variable: TextBoxVariable) => void;
  hideLabel?: boolean;
}

export function TextBoxVariableEditor({ variable, hideLabel }: TextBoxVariableEditorProps) {
  const { value } = variable.useState();

  const onTextValueChange = (e: FormEvent<HTMLInputElement>) => {
    variable.setState({ value: e.currentTarget.value });
  };

  return <TextBoxVariableForm defaultValue={value} onBlur={onTextValueChange} inline={true} />;
}

export function getTextBoxVariableOptions(variable: SceneVariable): OptionsPaneItemDescriptor[] {
  if (!(variable instanceof TextBoxVariable)) {
    console.warn('getTextBoxVariableOptions: variable is not a TextBoxVariable');
    return [];
  }

  return [
    new OptionsPaneItemDescriptor({
      title: t('dashboard-scene.textbox-variable-form.label-value', 'Value'),
      render: () => <TextBoxVariableEditor onChange={noop} variable={variable} hideLabel={true} />,
    }),
  ];
}