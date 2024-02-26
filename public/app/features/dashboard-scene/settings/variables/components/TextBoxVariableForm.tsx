import React, { FormEvent } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { VariableLegend } from 'app/features/dashboard-scene/settings/variables/components/VariableLegend';
import { VariableTextField } from 'app/features/dashboard-scene/settings/variables/components/VariableTextField';

interface TextBoxVariableFormProps {
  value?: string;
  defaultValue?: string;
  onChange?: (event: FormEvent<HTMLInputElement>) => void;
  onBlur?: (event: FormEvent<HTMLInputElement>) => void;
}

export function TextBoxVariableForm({ defaultValue, value, onChange, onBlur }: TextBoxVariableFormProps) {
  return (
    <>
      <VariableLegend>Text options</VariableLegend>
      <VariableTextField
        value={value}
        defaultValue={defaultValue}
        name="Default value"
        placeholder="default value, if any"
        onChange={onChange}
        onBlur={onBlur}
        width={30}
        testId={selectors.pages.Dashboard.Settings.Variables.Edit.TextBoxVariable.textBoxOptionsQueryInputV2}
      />
    </>
  );
}
