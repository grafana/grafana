import React, { useState } from 'react';

import { ConstantVariable } from '@grafana/scenes';

import { ConstantVariableForm } from '../components/ConstantVariableForm';

interface ConstantVariableEditorProps {
  variable: ConstantVariable;
  onChange: (variable: ConstantVariable) => void;
}

export function ConstantVariableEditor({ variable }: ConstantVariableEditorProps) {
  const { value } = variable.useState();
  const [constantValue, setConstantValue] = useState<string>(String(value));

  const onConstantValueChange = (event: React.FormEvent<HTMLInputElement>) => {
    setConstantValue(event.currentTarget.value);
  };

  const onBlur = () => {
    variable.setState({ value: constantValue });
  };

  return <ConstantVariableForm constantValue={constantValue} onChange={onConstantValueChange} onBlur={onBlur} />;
}
