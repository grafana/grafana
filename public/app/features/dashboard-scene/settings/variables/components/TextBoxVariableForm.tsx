import { FormEvent } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from 'app/core/internationalization';
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
        <Trans i18nKey="bmcgrafana.dashboards.settings.variables.editor.types.text-box.title">Text options</Trans>
      </VariableLegend>
      <VariableTextField
        value={value}
        defaultValue={defaultValue}
        name={t('bmcgrafana.dashboards.settings.variables.editor.types.text-box.default-value', 'Default value')}
        placeholder={t(
          'bmcgrafana.dashboards.settings.variables.editor.types.text-box.placeholder',
          'default value, if any'
        )}
        onChange={onChange}
        onBlur={onBlur}
        width={30}
        testId={selectors.pages.Dashboard.Settings.Variables.Edit.TextBoxVariable.textBoxOptionsQueryInputV2}
      />
    </>
  );
}
