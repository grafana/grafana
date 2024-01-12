import React, { FormEvent } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { SelectionOptionsForm } from 'app/features/dashboard-scene/settings/variables/components/SelectionOptionsForm';

import { VariableLegend } from '../components/VariableLegend';
import { VariableTextAreaField } from '../components/VariableTextAreaField';

interface CustomVariableFormProps {
  query: string;
  multi: boolean;
  allValue?: string | null;
  includeAll: boolean;
  onQueryChange: (event: FormEvent<HTMLTextAreaElement>) => void;
  onBlur: (event: FormEvent<HTMLTextAreaElement>) => void;
  onMultiChange: (event: FormEvent<HTMLInputElement>) => void;
  onIncludeAllChange: (event: FormEvent<HTMLInputElement>) => void;
  onAllValueChange: (event: FormEvent<HTMLInputElement>) => void;
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
  onBlur,
}: CustomVariableFormProps) {
  return (
    <>
      <VariableLegend>Custom options</VariableLegend>

      <VariableTextAreaField
        name="Values separated by comma"
        value={query}
        placeholder="1, 10, mykey : myvalue, myvalue, escaped\,value"
        onChange={onQueryChange}
        onBlur={onBlur}
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
