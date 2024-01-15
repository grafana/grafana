import React from 'react';

import { TextBoxVariable } from '@grafana/scenes';

import { TextBoxVariableForm } from '../components/TextBoxVariableForm';

interface TextBoxVariableEditorProps {
  variable: TextBoxVariable;
  onChange: (variable: TextBoxVariable) => void;
}

export function TextBoxVariableEditor({ variable }: TextBoxVariableEditorProps) {
  const { value } = variable.useState();
  const onQueryChange = (event: React.FormEvent<HTMLInputElement>) => {
    variable.setState({ value: event.currentTarget.value });
  };

  const onBlur = (event: React.FormEvent<HTMLInputElement>) => {
    variable.setState({ value: event.currentTarget.value });
  };

  return <TextBoxVariableForm value={value} onChange={onQueryChange} onBlur={onBlur} />;
}
