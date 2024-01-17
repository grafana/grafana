import React, { FormEvent } from 'react';

import { selectors } from '@grafana/e2e-selectors';

import { VariableLegend } from '../components/VariableLegend';
import { VariableTextAreaField } from '../components/VariableTextAreaField';

import { SelectionOptionsForm } from './SelectionOptionsForm';

interface CustomVariableFormProps {
  query: string;
  multi: boolean;
  allValue?: string | null;
  includeAll: boolean;
  onQueryChange: (event: FormEvent<HTMLTextAreaElement>) => void;
  onMultiChange: (event: FormEvent<HTMLInputElement>) => void;
  onIncludeAllChange: (event: FormEvent<HTMLInputElement>) => void;
  onAllValueChange: (event: FormEvent<HTMLInputElement>) => void;
  onQueryBlur?: (event: FormEvent<HTMLTextAreaElement>) => void;
  onAllValueBlur?: (event: FormEvent<HTMLInputElement>) => void;
}

export function CustomVariableForm({
  query,
  multi,
  allValue,
  includeAll,
  onQueryChange,
  onMultiChange,
  onIncludeAllChange,
  onAllValueChange,
}: CustomVariableFormProps) {
  return (
    <>
      <VariableLegend>Custom options</VariableLegend>

      <VariableTextAreaField
        name="Values separated by comma"
        defaultValue={query}
        placeholder="1, 10, mykey : myvalue, myvalue, escaped\,value"
        onBlur={onQueryChange}
        required
        width={52}
        testId={selectors.pages.Dashboard.Settings.Variables.Edit.CustomVariable.customValueInput}
      />
      <VariableLegend>Selection options</VariableLegend>
      <SelectionOptionsForm
        multi={multi}
        includeAll={includeAll}
        allValue={allValue}
        onMultiChange={onMultiChange}
        onIncludeAllChange={onIncludeAllChange}
        onAllValueChange={onAllValueChange}
      />
    </>
  );
}
