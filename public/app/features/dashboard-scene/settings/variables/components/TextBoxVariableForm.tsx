import { FormEvent } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from 'app/core/internationalization';
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
      <VariableLegend>
        <Trans i18nKey="dashboard-scene.text-box-variable-form.text-options">Text options</Trans>
      </VariableLegend>
      <VariableTextField
        value={value}
        defaultValue={defaultValue}
        name="Default value"
        placeholder={t('dashboard-scene.text-box-variable-form.placeholder-default-value-if-any', '(optional)')}
        onChange={onChange}
        onBlur={onBlur}
        width={30}
        testId={selectors.pages.Dashboard.Settings.Variables.Edit.TextBoxVariable.textBoxOptionsQueryInputV2}
      />
    </>
  );
}
