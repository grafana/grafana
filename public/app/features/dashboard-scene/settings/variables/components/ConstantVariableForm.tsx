import React, { FormEvent } from 'react';

import { selectors } from '@grafana/e2e-selectors';

import { VariableLegend } from './VariableLegend';
import { VariableTextField } from './VariableTextField';

interface ConstantVariableFormProps {
  constantValue: string;
  onChange: (event: FormEvent<HTMLInputElement>) => void;
  onBlur: (event: FormEvent<HTMLInputElement>) => void;
}

export function ConstantVariableForm({ onChange, onBlur, constantValue }: ConstantVariableFormProps) {
  return (
    <>
      <VariableLegend>Constant options</VariableLegend>
      <VariableTextField
        value={constantValue}
        name="Value"
        placeholder="your metric prefix"
        onChange={onChange}
        onBlur={onBlur}
        testId={selectors.pages.Dashboard.Settings.Variables.Edit.ConstantVariable.constantOptionsQueryInputV2}
        width={30}
      />
    </>
  );
}
