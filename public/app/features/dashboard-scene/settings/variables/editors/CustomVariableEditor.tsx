import React from 'react';

import { CustomVariable } from '@grafana/scenes';

import { CustomVariableForm } from '../components/CustomVariableForm';

interface CustomVariableEditorProps {
  variable: CustomVariable;
  onChange: (variable: CustomVariable) => void;
}

export function CustomVariableEditor({ variable }: CustomVariableEditorProps) {
  const { query, isMulti, allValue, includeAll } = variable.useState();

  const onQueryChange = (event: React.FormEvent<HTMLTextAreaElement>) => {
    variable.setState({ query: event.currentTarget.value });
  };
  const onBlur = (event: React.FormEvent<HTMLTextAreaElement>) => {
    variable.setState({ query: event.currentTarget.value });
  };
  const onMultiChange = (event: React.FormEvent<HTMLInputElement>) => {
    variable.setState({ isMulti: event.currentTarget.checked });
  };
  const onIncludeAllChange = (event: React.FormEvent<HTMLInputElement>) => {
    variable.setState({ includeAll: event.currentTarget.checked });
  };
  const onAllValueChange = (event: React.FormEvent<HTMLInputElement>) => {
    variable.setState({ allValue: event.currentTarget.value });
  };

  return (
    <CustomVariableForm
      query={query}
      multi={!!isMulti}
      allValue={allValue}
      includeAll={!!includeAll}
      onQueryChange={onQueryChange}
      onBlur={onBlur}
      onMultiChange={onMultiChange}
      onIncludeAllChange={onIncludeAllChange}
      onAllValueChange={onAllValueChange}
    />
  );
}
