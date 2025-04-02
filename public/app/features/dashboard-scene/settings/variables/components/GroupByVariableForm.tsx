import { FormEvent, useCallback } from 'react';

import { DataSourceInstanceSettings, MetricFindValue, readCSV } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { DataSourceRef } from '@grafana/schema';
import { Alert, CodeEditor, Field, Switch } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';

import { VariableCheckboxField } from './VariableCheckboxField';
import { VariableLegend } from './VariableLegend';

export interface GroupByVariableFormProps {
  datasource?: DataSourceRef;
  onDataSourceChange: (dsSettings: DataSourceInstanceSettings) => void;
  onDefaultOptionsChange: (options?: MetricFindValue[]) => void;
  infoText?: string;
  defaultOptions?: MetricFindValue[];
  allowCustomValue: boolean;
  onAllowCustomValueChange: (event: FormEvent<HTMLInputElement>) => void;
}

export function GroupByVariableForm({
  datasource,
  defaultOptions,
  infoText,
  onDataSourceChange,
  onDefaultOptionsChange,
  allowCustomValue,
  onAllowCustomValueChange,
}: GroupByVariableFormProps) {
  const updateDefaultOptions = useCallback(
    (csvContent: string) => {
      const df = readCSV('key,value\n' + csvContent)[0];
      const options = [];
      for (let i = 0; i < df.length; i++) {
        options.push({ text: df.fields[0].values[i], value: df.fields[1].values[i] });
      }

      onDefaultOptionsChange(options);
    },
    [onDefaultOptionsChange]
  );

  return (
    <>
      <VariableLegend>
        <Trans i18nKey="dashboard-scene.group-by-variable-form.group-by-options">Group by options</Trans>
      </VariableLegend>
      <Field
        label={t('dashboard-scene.group-by-variable-form.label-data-source', 'Data source')}
        htmlFor="data-source-picker"
      >
        <DataSourcePicker current={datasource} onChange={onDataSourceChange} width={30} variables={true} noDefault />
      </Field>

      {infoText ? (
        <Alert
          title={infoText}
          severity="info"
          data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.GroupByVariable.infoText}
        />
      ) : null}

      <Field
        label={t(
          'dashboard-scene.group-by-variable-form.label-use-static-group-by-dimensions',
          'Use static group dimensions'
        )}
        description={t(
          'dashboard-scene.group-by-variable-form.description-provide-dimensions-as-csv-dimension-name-dimension-id',
          'Provide dimensions as CSV: {{name}}, {{value}}',
          { name: 'dimensionName', value: 'dimensionId' }
        )}
      >
        <Switch
          data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.GroupByVariable.modeToggle}
          value={defaultOptions !== undefined}
          onChange={(e) => {
            if (defaultOptions === undefined) {
              onDefaultOptionsChange([]);
            } else {
              onDefaultOptionsChange(undefined);
            }
          }}
        />
      </Field>

      {defaultOptions !== undefined && (
        <CodeEditor
          height={300}
          language="csv"
          value={defaultOptions.map((o) => `${o.text},${o.value}`).join('\n')}
          onBlur={updateDefaultOptions}
          onSave={updateDefaultOptions}
          showMiniMap={false}
          showLineNumbers={true}
        />
      )}

      <VariableCheckboxField
        value={allowCustomValue}
        name="Allow custom values"
        description={t(
          'dashboard-scene.group-by-variable-form.description-enables-users-custom-values',
          'Enables users to add custom values to the list'
        )}
        onChange={onAllowCustomValueChange}
        testId={selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsAllowCustomValueSwitch}
      />
    </>
  );
}
