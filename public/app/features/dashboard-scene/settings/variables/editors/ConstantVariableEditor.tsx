import React from 'react';

import { ConstantVariable } from '@grafana/scenes';

import { ConstantVariableForm } from '../components/ConstantVariableForm';

interface ConstantVariableEditorProps {
  variable: ConstantVariable;
}

export function ConstantVariableEditor({ variable }: ConstantVariableEditorProps) {
  const { value } = variable.useState();

  const onConstantValueChange = (event: React.FormEvent<HTMLInputElement>) => {
    variable.setState({ value: event.currentTarget.value });
  };

  return <ConstantVariableForm constantValue={String(value)} onChange={onConstantValueChange} />;
}
