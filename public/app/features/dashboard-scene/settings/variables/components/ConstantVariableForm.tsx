import { FormEvent } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from 'app/core/internationalization';

import { VariableLegend } from './VariableLegend';
import { VariableTextField } from './VariableTextField';

interface ConstantVariableFormProps {
  constantValue: string;
  onChange: (event: FormEvent<HTMLInputElement>) => void;
}

export function ConstantVariableForm({ onChange, constantValue }: ConstantVariableFormProps) {
  return (
    <>
      <VariableLegend>
        <Trans i18nKey="dashboard-scene.constant-variable-form.constant-options">Constant options</Trans>
      </VariableLegend>
      <VariableTextField
        defaultValue={constantValue}
        name="Value"
        placeholder={t('dashboard-scene.constant-variable-form.placeholder-your-metric-prefix', 'Your metric prefix')}
        onBlur={onChange}
        testId={selectors.pages.Dashboard.Settings.Variables.Edit.ConstantVariable.constantOptionsQueryInputV2}
        width={30}
      />
    </>
  );
}
