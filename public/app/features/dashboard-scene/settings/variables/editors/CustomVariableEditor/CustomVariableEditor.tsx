import { FormEvent, useCallback } from 'react';

import { CustomVariable } from '@grafana/scenes';

import { CustomVariableForm } from '../../components/CustomVariableForm';

interface CustomVariableEditorProps {
  variable: CustomVariable;
  onRunQuery: () => void;
}

export function CustomVariableEditor({ variable, onRunQuery }: CustomVariableEditorProps) {
  const { query, isMulti, allValue, includeAll, allowCustomValue } = variable.useState();

  const onMultiChange = useCallback(
    (event: FormEvent<HTMLInputElement>) => {
      variable.setState({ isMulti: event.currentTarget.checked });
    },
    [variable]
  );

  const onIncludeAllChange = useCallback(
    (event: FormEvent<HTMLInputElement>) => {
      variable.setState({ includeAll: event.currentTarget.checked });
    },
    [variable]
  );

  const onQueryChange = useCallback(
    (event: FormEvent<HTMLTextAreaElement>) => {
      variable.setState({ query: event.currentTarget.value });
      onRunQuery();
    },
    [variable, onRunQuery]
  );

  const onAllValueChange = useCallback(
    (event: FormEvent<HTMLInputElement>) => {
      variable.setState({ allValue: event.currentTarget.value });
    },
    [variable]
  );

  const onAllowCustomValueChange = useCallback(
    (event: FormEvent<HTMLInputElement>) => {
      variable.setState({ allowCustomValue: event.currentTarget.checked });
    },
    [variable]
  );

  return (
    <CustomVariableForm
      query={query ?? ''}
      multi={!!isMulti}
      allValue={allValue ?? ''}
      includeAll={!!includeAll}
      allowCustomValue={allowCustomValue}
      onMultiChange={onMultiChange}
      onIncludeAllChange={onIncludeAllChange}
      onQueryChange={onQueryChange}
      onAllValueChange={onAllValueChange}
      onAllowCustomValueChange={onAllowCustomValueChange}
    />
  );
}
