import React, { useCallback } from 'react';

import { DataSourceInstanceSettings, MetricFindValue, readCSV } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { DataSourceRef } from '@grafana/schema';
import { Alert, CodeEditor, Field, Switch } from '@grafana/ui';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';

import { VariableLegend } from './VariableLegend';

export interface AdHocVariableFormProps {
  datasource?: DataSourceRef;
  onDataSourceChange: (dsSettings: DataSourceInstanceSettings) => void;
  infoText?: string;
  staticKeys?: MetricFindValue[];
  onStaticKeysChange?: (keys?: MetricFindValue[]) => void;
}

export function AdHocVariableForm({
  datasource,
  infoText,
  onDataSourceChange,
  onStaticKeysChange,
  staticKeys,
}: AdHocVariableFormProps) {
  const updateStaticKeys = useCallback(
    (csvContent: string) => {
      const df = readCSV('key,value\n' + csvContent)[0];
      const options = [];
      for (let i = 0; i < df.length; i++) {
        options.push({ text: df.fields[0].values[i], value: df.fields[1].values[i] });
      }

      onStaticKeysChange?.(options);
    },
    [onStaticKeysChange]
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

      {onStaticKeysChange && (
        <>
          <Field label="Use static key dimensions" description="Provide dimensions as CSV: dimensionName, dimensionId">
            <Switch
              data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.AdHocFiltersVariable.modeToggle}
              value={staticKeys !== undefined}
              onChange={(e) => {
                if (staticKeys === undefined) {
                  onStaticKeysChange([]);
                } else {
                  onStaticKeysChange(undefined);
                }
              }}
            />
          </Field>

          {staticKeys !== undefined && (
            <CodeEditor
              height={300}
              language="csv"
              value={staticKeys.map((o) => `${o.text},${o.value}`).join('\n')}
              onBlur={updateStaticKeys}
              onSave={updateStaticKeys}
              showMiniMap={false}
              showLineNumbers={true}
            />
          )}
        </>
      )}
    </>
  );
}
