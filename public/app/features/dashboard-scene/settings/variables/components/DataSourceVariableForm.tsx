import { type FormEvent } from 'react';

import { type SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';

import { SelectionOptionsForm } from './SelectionOptionsForm';
import { VariableLegend } from './VariableLegend';
import { VariableSelectField } from './VariableSelectField';
import { VariableTextField } from './VariableTextField';

interface DataSourceVariableFormProps {
  query: string;
  regex: string;
  labels?: string;
  multi: boolean;
  allValue?: string | null;
  allowCustomValue?: boolean;
  includeAll: boolean;
  onChange: (option: SelectableValue) => void;
  optionTypes: Array<{ value: string; label: string }>;
  onRegExBlur: (event: FormEvent<HTMLInputElement>) => void;
  onLabelsBlur?: (event: FormEvent<HTMLInputElement>) => void;
  onMultiChange: (event: FormEvent<HTMLInputElement>) => void;
  onIncludeAllChange: (event: FormEvent<HTMLInputElement>) => void;
  onAllValueChange: (event: FormEvent<HTMLInputElement>) => void;
  onAllowCustomValueChange?: (event: FormEvent<HTMLInputElement>) => void;
  onQueryBlur?: (event: FormEvent<HTMLTextAreaElement>) => void;
  onAllValueBlur?: (event: FormEvent<HTMLInputElement>) => void;
}

export function DataSourceVariableForm({
  query,
  regex,
  labels,
  optionTypes,
  allowCustomValue,
  onChange,
  onRegExBlur,
  onLabelsBlur,
  multi,
  includeAll,
  allValue,
  onMultiChange,
  onIncludeAllChange,
  onAllValueChange,
  onAllowCustomValueChange,
}: DataSourceVariableFormProps) {
  const typeValue = optionTypes.find((o) => o.value === query);

  return (
    <>
      <VariableLegend>
        <Trans i18nKey="dashboard-scene.data-source-variable-form.data-source-options">Data source options</Trans>
      </VariableLegend>
      <VariableSelectField
        name={t('dashboard-scene.data-source-variable-form.name-type', 'Type')}
        value={typeValue}
        options={optionTypes}
        onChange={onChange}
        testId={selectors.pages.Dashboard.Settings.Variables.Edit.DatasourceVariable.datasourceSelect}
      />

      <VariableTextField
        defaultValue={regex}
        name={t('dashboard-scene.data-source-variable-form.name-instance-name-filter', 'Instance name filter')}
        // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
        placeholder="/.*-(.*)-.*/"
        onBlur={onRegExBlur}
        description={
          <div>
            <Trans i18nKey="dashboard-scene.data-source-variable-form.description-instance-name-filter">
              Regex filter for which data source instances to choose from in the variable value list. Leave empty for
              all.
            </Trans>
            <br />
            <br />
            <Trans
              i18nKey="dashboard-scene.data-source-variable-form.example-instance-name-filter"
              components={{ codeExample: <code>/^prod/</code> }}
            >
              Example: {'<codeExample />'}
            </Trans>
          </div>
        }
      />

      <VariableTextField
        defaultValue={labels}
        name={t('dashboard-scene.data-source-variable-form.name-instance-label-filter', 'Instance label filter')}
        // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
        placeholder="env=prod, team=backend"
        onBlur={onLabelsBlur}
        description={
          <div>
            <Trans i18nKey="dashboard-scene.data-source-variable-form.description-instance-label-filter">
              Filter data source instances by key=value labels (comma-separated for multiple labels). Leave empty for
              all.
            </Trans>
          </div>
        }
      />

      <VariableLegend>
        <Trans i18nKey="dashboard-scene.data-source-variable-form.selection-options">Selection options</Trans>
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
