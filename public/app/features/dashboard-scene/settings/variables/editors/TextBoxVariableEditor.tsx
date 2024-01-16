import React, { useState } from 'react';

import { TextBoxVariable } from '@grafana/scenes';

import { TextBoxVariableForm } from '../components/TextBoxVariableForm';

interface TextBoxVariableEditorProps {
  variable: TextBoxVariable;
  onChange: (variable: TextBoxVariable) => void;
}

export function TextBoxVariableEditor({ variable }: TextBoxVariableEditorProps) {
  const { value } = variable.useState();
  const [textValue, setTextValue] = useState(value);

  const onTextValueChange = (event: React.FormEvent<HTMLInputElement>) => {
    setTextValue(event.currentTarget.value);
  };

  const onBlur = () => {
    variable.setState({ value: textValue });
  };

  return <TextBoxVariableForm value={textValue} onChange={onTextValueChange} onBlur={onBlur} />;
}
