import React, { FormEvent } from 'react';

import { TextBoxVariable } from '@grafana/scenes';

import { TextBoxVariableForm } from '../components/TextBoxVariableForm';

interface TextBoxVariableEditorProps {
  variable: TextBoxVariable;
  onChange: (variable: TextBoxVariable) => void;
}

export function TextBoxVariableEditor({ variable }: TextBoxVariableEditorProps) {
  const { value } = variable.useState();

  const onTextValueChange = (e: FormEvent<HTMLInputElement>) => {
    variable.setState({ value: e.currentTarget.value });
  };

  return <TextBoxVariableForm defaultValue={value} onBlur={onTextValueChange} />;
}
