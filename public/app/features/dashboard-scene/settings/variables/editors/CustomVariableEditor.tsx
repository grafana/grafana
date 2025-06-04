import { FormEvent } from 'react';
import { lastValueFrom } from 'rxjs';

import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n/internal';
import { CustomVariable, SceneVariable } from '@grafana/scenes';
import { TextArea } from '@grafana/ui';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { CustomVariableForm } from '../components/CustomVariableForm';

interface CustomVariableEditorProps {
  variable: CustomVariable;
  onRunQuery: () => void;
}

export function CustomVariableEditor({ variable, onRunQuery }: CustomVariableEditorProps) {
  const { query, isMulti, allValue, includeAll, allowCustomValue } = variable.useState();

  const onMultiChange = (event: FormEvent<HTMLInputElement>) => {
    variable.setState({ isMulti: event.currentTarget.checked });
  };
  const onIncludeAllChange = (event: FormEvent<HTMLInputElement>) => {
    variable.setState({ includeAll: event.currentTarget.checked });
  };
  const onQueryChange = (event: FormEvent<HTMLTextAreaElement>) => {
    variable.setState({ query: event.currentTarget.value });
    onRunQuery();
  };
  const onAllValueChange = (event: FormEvent<HTMLInputElement>) => {
    variable.setState({ allValue: event.currentTarget.value });
  };
  const onAllowCustomValueChange = (event: FormEvent<HTMLInputElement>) => {
    variable.setState({ allowCustomValue: event.currentTarget.checked });
  };

  return (
    <CustomVariableForm
      query={query ?? ''}
      multi={!!isMulti}
      allValue={allValue ?? ''}
      includeAll={!!includeAll}
      allowCustomValue={allowCustomValue}
      onMultiChange={onMultiChange}
      onIncludeAllChange={onIncludeAllChange}
      onQueryChange={onQueryChange}
      onAllValueChange={onAllValueChange}
      onAllowCustomValueChange={onAllowCustomValueChange}
    />
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
