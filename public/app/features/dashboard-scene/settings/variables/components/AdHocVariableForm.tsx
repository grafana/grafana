import { FormEvent, useCallback } from 'react';

import { DataSourceInstanceSettings, MetricFindValue, readCSV } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { DataSourceRef } from '@grafana/schema';
import { Alert, Box, CodeEditor, Field, Stack, Switch } from '@grafana/ui';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';

import { VariableCheckboxField } from './VariableCheckboxField';
import { VariableLegend } from './VariableLegend';

export interface AdHocVariableFormProps {
  datasource?: DataSourceRef;
  onDataSourceChange: (dsSettings: DataSourceInstanceSettings) => void;
  allowCustomValue?: boolean;
  infoText?: string;
  defaultKeys?: MetricFindValue[];
  onDefaultKeysChange?: (keys?: MetricFindValue[]) => void;
  onAllowCustomValueChange?: (event: FormEvent<HTMLInputElement>) => void;
  collapseFilters?: boolean;
  onCollapseFiltersValueChange?: (event: FormEvent<HTMLInputElement>) => void;
}

export function AdHocVariableForm({
  datasource,
  infoText,
  allowCustomValue,
  onDataSourceChange,
  onDefaultKeysChange,
  onAllowCustomValueChange,
  defaultKeys,
  collapseFilters,
  onCollapseFiltersValueChange,
}: AdHocVariableFormProps) {
  const updateStaticKeys = useCallback(
    (csvContent: string) => {
      const df = readCSV('key,value\n' + csvContent)[0];
      const options = [];
      for (let i = 0; i < df.length; i++) {
        options.push({ text: df.fields[0].values[i], value: df.fields[1].values[i] });
      }

      onDefaultKeysChange?.(options);
    },
    [onDefaultKeysChange]
  );

  return (
    <>
      <VariableLegend>Ad-hoc options</VariableLegend>
      <Field label="Data source" htmlFor="data-source-picker">
        <DataSourcePicker current={datasource} onChange={onDataSourceChange} width={30} variables={true} noDefault />
      </Field>

      {infoText ? (
        <Alert
          title={infoText}
          severity="info"
          data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.AdHocFiltersVariable.infoText}
        />
      ) : null}
      {onDefaultKeysChange && (
        <>
          <Field label="Use static key dimensions" description="Provide dimensions as CSV: dimensionName, dimensionId">
            <Switch
              data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.AdHocFiltersVariable.modeToggle}
              value={defaultKeys !== undefined}
              onChange={(e) => {
                if (defaultKeys === undefined) {
                  onDefaultKeysChange([]);
                } else {
                  onDefaultKeysChange(undefined);
                }
              }}
            />
          </Field>

          {defaultKeys !== undefined && (
            <Box marginBottom={2}>
              <CodeEditor
                height={300}
                language="csv"
                value={defaultKeys.map((o) => `${o.text},${o.value}`).join('\n')}
                onBlur={updateStaticKeys}
                onSave={updateStaticKeys}
                showMiniMap={false}
                showLineNumbers={true}
              />
            </Box>
          )}
        </>
      )}
      <Stack direction="column" gap={2} height="inherit" alignItems="start">
        {onAllowCustomValueChange && (
          <VariableCheckboxField
            value={allowCustomValue ?? true}
            name="Allow custom values"
            description="Enables users to add custom values to the list"
            onChange={onAllowCustomValueChange}
            testId={selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsAllowCustomValueSwitch}
          />
        )}
        {onCollapseFiltersValueChange && (
          <VariableCheckboxField
            value={collapseFilters ?? false}
            name="Collapse filters"
            description="Automatically collapse filters when they span for more than two lines"
            onChange={onCollapseFiltersValueChange}
            testId={selectors.pages.Dashboard.Settings.Variables.Edit.AdHocFiltersVariable.collapseFiltersToggle}
          />
        )}
      </Stack>
    </>
  );
}
