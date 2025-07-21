import { FormEvent, ReactElement, useCallback } from 'react';

import { TextBoxVariableModel } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';

import { VariableLegend } from '../../dashboard-scene/settings/variables/components/VariableLegend';
import { VariableTextField } from '../../dashboard-scene/settings/variables/components/VariableTextField';
import { VariableEditorProps } from '../editor/types';

export interface Props extends VariableEditorProps<TextBoxVariableModel> {}

export function TextBoxVariableEditor({ onPropChange, variable: { query } }: Props): ReactElement {
  const updateVariable = useCallback(
    (event: FormEvent<HTMLInputElement>, updateOptions: boolean) => {
      event.preventDefault();
      onPropChange({ propName: 'originalQuery', propValue: event.currentTarget.value, updateOptions: false });
      onPropChange({ propName: 'query', propValue: event.currentTarget.value, updateOptions });
    },
    [onPropChange]
  );

  const onChange = useCallback((e: FormEvent<HTMLInputElement>) => updateVariable(e, false), [updateVariable]);
  const onBlur = useCallback((e: FormEvent<HTMLInputElement>) => updateVariable(e, true), [updateVariable]);

  return (
    <>
      <VariableLegend>
        <Trans i18nKey="variables.text-box-variable-editor.text-options">Text options</Trans>
      </VariableLegend>
      <VariableTextField
        value={query}
        name={t('variables.text-box-variable-editor.name-default-value', 'Default value')}
        placeholder={t('variables.text-box-variable-editor.placeholder-default-value-if-any', 'default value, if any')}
        onChange={onChange}
        onBlur={onBlur}
        width={30}
        testId={selectors.pages.Dashboard.Settings.Variables.Edit.TextBoxVariable.textBoxOptionsQueryInputV2}
      />
    </>
  );
}
