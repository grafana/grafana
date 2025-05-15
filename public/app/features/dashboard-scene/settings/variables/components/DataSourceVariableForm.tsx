import { FormEvent } from 'react';

import { SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans } from 'app/core/internationalization';

import { SelectionOptionsForm } from './SelectionOptionsForm';
import { VariableLegend } from './VariableLegend';
import { VariableSelectField } from './VariableSelectField';
import { VariableTextField } from './VariableTextField';

interface DataSourceVariableFormProps {
  query: string;
  regex: string;
  multi: boolean;
  allValue?: string | null;
  allowCustomValue?: boolean;
  includeAll: boolean;
  onChange: (option: SelectableValue) => void;
  optionTypes: Array<{ value: string; label: string }>;
  onRegExBlur: (event: FormEvent<HTMLInputElement>) => void;
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
  optionTypes,
  allowCustomValue,
  onChange,
  onRegExBlur,
  multi,
  includeAll,
  allValue,
  onMultiChange,
  onIncludeAllChange,
  onAllValueChange,
  onAllowCustomValueChange,
}: DataSourceVariableFormProps) {
  const typeValue = optionTypes.find((o) => o.value === query) ?? optionTypes[0];

  return (
    <>
      <VariableLegend>
        <Trans i18nKey="dashboard-scene.data-source-variable-form.data-source-options">Data source options</Trans>
      </VariableLegend>
      <VariableSelectField
        name="Type"
        value={typeValue}
        options={optionTypes}
        onChange={onChange}
        testId={selectors.pages.Dashboard.Settings.Variables.Edit.DatasourceVariable.datasourceSelect}
      />

      <VariableTextField
        defaultValue={regex}
        name="Instance name filter"
        // eslint-disable-next-line @grafana/no-untranslated-strings
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
