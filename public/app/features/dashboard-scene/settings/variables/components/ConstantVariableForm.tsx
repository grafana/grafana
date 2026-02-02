import { FormEvent } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from 'app/core/internationalization';

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
        <Trans i18nKey="bmcgrafana.dashboards.settings.variables.editor.types.constant.title">Constant options</Trans>
      </VariableLegend>
      <VariableTextField
        defaultValue={constantValue}
        name={t('bmcgrafana.dashboards.settings.variables.editor.types.constant.value', 'Value')}
        placeholder={t(
          'bmcgrafana.dashboards.settings.variables.editor.types.constant.placeholder',
          'your metric prefix'
        )}
        onBlur={onChange}
        testId={selectors.pages.Dashboard.Settings.Variables.Edit.ConstantVariable.constantOptionsQueryInputV2}
        width={30}
      />
    </>
  );
}
