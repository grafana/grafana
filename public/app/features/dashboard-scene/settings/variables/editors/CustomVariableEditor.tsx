import React, { useState } from 'react';

import { CustomVariable } from '@grafana/scenes';

import { CustomVariableForm } from '../components/CustomVariableForm';

interface CustomVariableEditorProps {
  variable: CustomVariable;
}

export function CustomVariableEditor({ variable }: CustomVariableEditorProps) {
  const { query: initialQuery, isMulti, allValue: initialAllValue, includeAll } = variable.useState();
  const [query, setQuery] = useState(initialQuery);
  const [allValue, setAllValue] = useState(initialAllValue);

  const onQueryChange = (event: React.FormEvent<HTMLTextAreaElement>) => {
    setQuery(event.currentTarget.value);
  };
  const onAllValueChange = (event: React.FormEvent<HTMLInputElement>) => {
    setAllValue(event.currentTarget.value);
  };
  const onMultiChange = (event: React.FormEvent<HTMLInputElement>) => {
    variable.setState({ isMulti: event.currentTarget.checked });
  };
  const onIncludeAllChange = (event: React.FormEvent<HTMLInputElement>) => {
    variable.setState({ includeAll: event.currentTarget.checked });
  };
  const onQueryBlur = () => {
    variable.setState({ query });
    // Call validateAndUpdate() to update the variable options
    variable.validateAndUpdate();
  };
  const onAllValueBlur = () => {
    variable.setState({ allValue });
  };

  return (
    <CustomVariableForm
      query={query}
      multi={!!isMulti}
      allValue={allValue}
      includeAll={!!includeAll}
      onQueryChange={onQueryChange}
      onMultiChange={onMultiChange}
      onIncludeAllChange={onIncludeAllChange}
      onAllValueChange={onAllValueChange}
      onQueryBlur={onQueryBlur}
      onAllValueBlur={onAllValueBlur}
    />
  );
}
