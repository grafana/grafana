import { FormEvent, useCallback } from 'react';

import { DataSourceInstanceSettings, MetricFindValue, readCSV } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { DataSourceRef } from '@grafana/schema';
import { Alert, CodeEditor, Field, Switch } from '@grafana/ui';
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
      <VariableLegend>Group by options</VariableLegend>
      <Field label="Data source" htmlFor="data-source-picker">
        <DataSourcePicker current={datasource} onChange={onDataSourceChange} width={30} variables={true} noDefault />
      </Field>

      {infoText ? (
        <Alert
          title={infoText}
          severity="info"
          data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.GroupByVariable.infoText}
        />
      ) : null}

      <Field label="Use static Group By dimensions" description="Provide dimensions as CSV: dimensionName, dimensionId">
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
        description="Enables users to add custom values to the list"
        onChange={onAllowCustomValueChange}
        testId={selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsAllowCustomValueSwitch}
      />
    </>
  );
}
