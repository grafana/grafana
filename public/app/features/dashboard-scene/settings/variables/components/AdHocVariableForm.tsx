import { FormEvent, useCallback } from 'react';

import { DataSourceInstanceSettings, MetricFindValue, readCSV } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { EditorField } from '@grafana/plugin-ui';
import { config } from '@grafana/runtime';
import { DataSourceRef } from '@grafana/schema';
import { Alert, CodeEditor, Field, Switch, Box } from '@grafana/ui';
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
  inline?: boolean;
  datasourceSupported: boolean;
}

export function AdHocVariableForm({
  datasource,
  infoText,
  allowCustomValue,
  onDataSourceChange,
  onDefaultKeysChange,
  onAllowCustomValueChange,
  defaultKeys,
  inline,
  datasourceSupported,
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
      {!inline && (
        <VariableLegend>
          <Trans i18nKey="dashboard-scene.ad-hoc-variable-form.adhoc-options">Ad-hoc options</Trans>
        </VariableLegend>
      )}

      <Box marginBottom={2}>
        <EditorField
          label={t('dashboard-scene.ad-hoc-variable-form.label-data-source', 'Data source')}
          htmlFor="data-source-picker"
          tooltip={infoText}
        >
          <DataSourcePicker
            current={datasource}
            onChange={onDataSourceChange}
            width={30}
            variables={true}
            dashboard={config.featureToggles.dashboardDsAdHocFiltering}
            noDefault
          />
        </EditorField>
      </Box>

      {datasourceSupported === false ? (
        <Alert
          title={t(
            'dashboard-scene.ad-hoc-variable-form.alert-not-supported',
            'This data source does not support ad hoc filters'
          )}
          severity="warning"
          data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.AdHocFiltersVariable.infoText}
        />
      ) : null}

      {datasourceSupported && onDefaultKeysChange && (
        <>
          <Field
            label={t(
              'dashboard-scene.ad-hoc-variable-form.label-use-static-key-dimensions',
              'Use static key dimensions'
            )}
            description={t(
              'dashboard-scene.ad-hoc-variable-form.description-provide-dimensions-as-csv-dimension-name-dimension-id',
              'Provide dimensions as CSV: {{name}}, {{value}}',
              { name: 'dimensionName', value: 'dimensionId' }
            )}
          >
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
            <CodeEditor
              height={300}
              language="csv"
              value={defaultKeys.map((o) => `${o.text},${o.value}`).join('\n')}
              onBlur={updateStaticKeys}
              onSave={updateStaticKeys}
              showMiniMap={false}
              showLineNumbers={true}
            />
          )}
        </>
      )}

      {datasourceSupported && onAllowCustomValueChange && (
        <VariableCheckboxField
          value={allowCustomValue ?? true}
          name={t('dashboard-scene.ad-hoc-variable-form.name-allow-custom-values', 'Allow custom values')}
          description={t(
            'dashboard-scene.ad-hoc-variable-form.description-enables-users-custom-values',
            'Enables users to add custom values to the list'
          )}
          onChange={onAllowCustomValueChange}
          testId={selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsAllowCustomValueSwitch}
        />
      )}
    </>
  );
}
