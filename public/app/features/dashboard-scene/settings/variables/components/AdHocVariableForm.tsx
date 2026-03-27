import { css } from '@emotion/css';
import { FormEvent, useCallback } from 'react';

import { DataSourceInstanceSettings, GrafanaTheme2, MetricFindValue, readCSV } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { EditorField } from '@grafana/plugin-ui';
import { config } from '@grafana/runtime';
import { AdHocFiltersController } from '@grafana/scenes';
import { DataSourceRef } from '@grafana/schema';
import { Alert, CodeEditor, Field, Switch, Stack, useStyles2 } from '@grafana/ui';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';

import { AdHocOriginFiltersEditor } from './AdHocOriginFiltersEditor';
import { VariableLegend } from './VariableLegend';
export interface AdHocVariableFormProps {
  datasource?: DataSourceRef;
  onDataSourceChange: (dsSettings: DataSourceInstanceSettings) => void;
  allowCustomValue?: boolean;
  enableGroupBy?: boolean;
  infoText?: string;
  defaultKeys?: MetricFindValue[];
  onDefaultKeysChange?: (keys?: MetricFindValue[]) => void;
  onAllowCustomValueChange?: (event: FormEvent<HTMLInputElement>) => void;
  onEnableGroupByChange?: (event: FormEvent<HTMLInputElement>) => void;
  originFiltersController?: AdHocFiltersController;
  inline?: boolean;
  datasourceSupported: boolean;
  datasourceSupportsGroupBy?: boolean;
}

export function AdHocVariableForm({
  datasource,
  infoText,
  allowCustomValue,
  enableGroupBy,
  onDataSourceChange,
  onDefaultKeysChange,
  onAllowCustomValueChange,
  onEnableGroupByChange,
  originFiltersController,
  defaultKeys,
  inline,
  datasourceSupported,
  datasourceSupportsGroupBy,
}: AdHocVariableFormProps) {
  const styles = useStyles2(getStyles);
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
    <Stack direction="column" gap={2}>
      {!inline && (
        <VariableLegend>
          <Trans i18nKey="dashboard-scene.ad-hoc-variable-form.adhoc-options">Filter options</Trans>
        </VariableLegend>
      )}

      <EditorField
        label={t('dashboard-scene.ad-hoc-variable-form.label-data-source', 'Data source')}
        htmlFor="data-source-picker"
        tooltip={infoText}
      >
        <DataSourcePicker
          current={datasource}
          onChange={onDataSourceChange}
          width={inline ? undefined : 30}
          variables={true}
          dashboard={true}
          noDefault
        />
      </EditorField>

      {datasourceSupported === false ? (
        <Alert
          title={t(
            'dashboard-scene.ad-hoc-variable-form.alert-not-supported',
            'This data source does not support filters'
          )}
          severity="warning"
          bottomSpacing={0}
          data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.AdHocFiltersVariable.infoText}
        />
      ) : null}

      {datasourceSupported && originFiltersController && (
        <div className={!inline ? styles.originFiltersWrapper : undefined}>
          <AdHocOriginFiltersEditor controller={originFiltersController} />
        </div>
      )}

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
            noMargin
          >
            <Switch
              data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.AdHocFiltersVariable.modeToggle}
              value={defaultKeys != null}
              onChange={(e) => {
                if (defaultKeys == null) {
                  onDefaultKeysChange([]);
                } else {
                  onDefaultKeysChange(undefined);
                }
              }}
            />
          </Field>

          {defaultKeys != null && (
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
        <Field
          label={t('dashboard-scene.ad-hoc-variable-form.name-allow-custom-values', 'Allow custom values')}
          description={t(
            'dashboard-scene.ad-hoc-variable-form.description-enables-users-custom-values',
            'Enables users to add custom values to the list'
          )}
          noMargin
        >
          <Switch
            value={allowCustomValue ?? true}
            onChange={onAllowCustomValueChange}
            data-testid={
              selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsAllowCustomValueSwitch
            }
          />
        </Field>
      )}

      {config.featureToggles.dashboardUnifiedDrilldownControls &&
        datasource &&
        datasourceSupported &&
        datasourceSupportsGroupBy &&
        onEnableGroupByChange && (
          <Field
            label={t('dashboard-scene.ad-hoc-variable-form.name-enable-group-by', 'Enable group by')}
            description={t(
              'dashboard-scene.ad-hoc-variable-form.description-enable-group-by',
              'Enables group by operator in the filter combobox'
            )}
            noMargin
          >
            <Switch
              value={enableGroupBy ?? false}
              onChange={onEnableGroupByChange}
              data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.AdHocFiltersVariable.enableGroupByToggle}
            />
          </Field>
        )}
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  originFiltersWrapper: css({
    maxWidth: theme.spacing(55),
  }),
});
