import { FormEvent } from 'react';
import { lastValueFrom } from 'rxjs';

import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { CustomVariable, SceneVariable } from '@grafana/scenes';
import { TextArea } from '@grafana/ui';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { VariableLegend } from '../components/VariableLegend';
import { VariableTextAreaField } from '../components/VariableTextAreaField';

import { SelectionOptionsForm } from './SelectionOptionsForm';

interface CustomVariableFormProps {
  query: string;
  multi: boolean;
  allValue?: string | null;
  includeAll: boolean;
  allowCustomValue?: boolean;
  onQueryChange: (event: FormEvent<HTMLTextAreaElement>) => void;
  onMultiChange: (event: FormEvent<HTMLInputElement>) => void;
  onIncludeAllChange: (event: FormEvent<HTMLInputElement>) => void;
  onAllValueChange: (event: FormEvent<HTMLInputElement>) => void;
  onQueryBlur?: (event: FormEvent<HTMLTextAreaElement>) => void;
  onAllValueBlur?: (event: FormEvent<HTMLInputElement>) => void;
  onAllowCustomValueChange?: (event: FormEvent<HTMLInputElement>) => void;
}

export function CustomVariableForm({
  query,
  multi,
  allValue,
  includeAll,
  allowCustomValue,
  onQueryChange,
  onMultiChange,
  onIncludeAllChange,
  onAllValueChange,
  onAllowCustomValueChange,
}: CustomVariableFormProps) {
  return (
    <>
      <VariableLegend>
        <Trans i18nKey="dashboard-scene.custom-variable-form.custom-options">Custom options</Trans>
      </VariableLegend>

      <VariableTextAreaField
        name={t('dashboard-scene.custom-variable-form.name-values-separated-comma', 'Values separated by comma')}
        defaultValue={query}
        // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
        placeholder="1, 10, mykey : myvalue, myvalue, escaped\,value"
        onBlur={onQueryChange}
        required
        width={52}
        testId={selectors.pages.Dashboard.Settings.Variables.Edit.CustomVariable.customValueInput}
      />
      <VariableLegend>
        <Trans i18nKey="dashboard-scene.custom-variable-form.selection-options">Selection options</Trans>
      </VariableLegend>
      <SelectionOptionsForm
        multi={multi}
        includeAll={includeAll}
        allValue={allValue}
        allowCustomValue={allowCustomValue}
        onMultiChange={onMultiChange}
        onIncludeAllChange={onIncludeAllChange}
        onAllValueChange={onAllValueChange}
        onAllowCustomValueChange={onAllowCustomValueChange}
      />
    </>
  );
}

export function getCustomVariableOptions(variable: SceneVariable): OptionsPaneItemDescriptor[] {
  if (!(variable instanceof CustomVariable)) {
    return [];
  }

  return [
    new OptionsPaneItemDescriptor({
      title: t('dashboard.edit-pane.variable.custom-options.values', 'Values separated by comma'),
      render: () => <ValuesTextField variable={variable} />,
    }),
  ];
}

function ValuesTextField({ variable }: { variable: CustomVariable }) {
  const { query } = variable.useState();

  const onBlur = async (event: FormEvent<HTMLTextAreaElement>) => {
    variable.setState({ query: event.currentTarget.value });
    await lastValueFrom(variable.validateAndUpdate!());
  };

  return (
    <TextArea
      rows={2}
      defaultValue={query}
      onBlur={onBlur}
      placeholder={t(
        'dashboard.edit-pane.variable.custom-options.values-placeholder',
        '1, 10, mykey : myvalue, myvalue, escaped\,value'
      )}
      required
      data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.CustomVariable.customValueInput}
    />
  );
}
