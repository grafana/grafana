import React from 'react';

import { ConstantVariable } from '@grafana/scenes';

import { ConstantVariableForm } from '../components/ConstantVariableForm';

interface ConstantVariableEditorProps {
  variable: ConstantVariable;
  onChange: (variable: ConstantVariable) => void;
}

export function ConstantVariableEditor({ variable }: ConstantVariableEditorProps) {
  const { value } = variable.useState();

  const onConstantValueChange = (event: React.FormEvent<HTMLInputElement>) => {
    variable.setState({ value: event.currentTarget.value });
  };

  const onBlur = (event: React.FormEvent<HTMLInputElement>) => {
    variable.setState({ value: event.currentTarget.value });
  };

  return <ConstantVariableForm constantValue={value} onChange={onConstantValueChange} onBlur={onBlur} />;
}
