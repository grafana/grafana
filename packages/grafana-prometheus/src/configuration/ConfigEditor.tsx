import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { ConfigSection, DataSourceDescription, AdvancedHttpSettings } from '@grafana/plugin-ui';
import { Switch } from '@grafana/ui';
import { config } from '@grafana/runtime';
import { Alert, useTheme2, Field } from '@grafana/ui';
import React from 'react';

import { PromOptions } from '../types';

import { AlertingSettingsOverhaul } from './AlertingSettingsOverhaul';
import { DataSourceHttpSettingsOverhaul } from './DataSourceHttpSettingsOverhaul';
import { PromSettings } from './PromSettings';
import { overhaulStyles } from './shared/utils';

type PrometheusConfigProps = DataSourcePluginOptionsEditorProps<PromOptions>;

export const ConfigEditor = (props: PrometheusConfigProps) => {
  const { options, onOptionsChange } = props;
  const theme = useTheme2();
  const styles = overhaulStyles(theme);

  const onHideWarningsChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const hideWarnings = event.target.checked;
    onOptionsChange({
      ...options,
      jsonData: {
        ...options.jsonData,
        hideWarnings,
      },
    });
  };

  return (
    <>
      {options.access === 'direct' && (
        <Alert title={t('grafana-prometheus.configuration.config-editor.title-error', 'Error')} severity="error">
          <Trans i18nKey="grafana-prometheus.configuration.config-editor.browser-access-mode-error">
            Browser access mode in the Prometheus data source is no longer available. Switch to server access mode.
          </Trans>
        </Alert>
      )}
      <DataSourceDescription
        dataSourceName="Prometheus"
        docsLink="https://grafana.com/docs/grafana/latest/datasources/prometheus/configure/"
      />
      <hr className={`${styles.hrTopSpace} ${styles.hrBottomSpace}`} />
      <DataSourceHttpSettingsOverhaul
        options={options}
        onOptionsChange={onOptionsChange}
        secureSocksDSProxyEnabled={config.secureSocksDSProxyEnabled}
      />
      <hr />
      <ConfigSection
        className={styles.advancedSettings}
        title={t('grafana-prometheus.configuration.config-editor.title-advanced-settings', 'Advanced settings')}
        description={t(
          'grafana-prometheus.configuration.config-editor.description-advanced-settings',
          'Additional settings are optional settings that can be configured for more control over your data source.'
        )}
      >
        <AdvancedHttpSettings
          className={styles.advancedHTTPSettingsMargin}
          config={options}
          onChange={onOptionsChange}
        />
        <AlertingSettingsOverhaul<PromOptions> options={options} onOptionsChange={onOptionsChange} />
        <PromSettings options={options} onOptionsChange={onOptionsChange} />

        {/* --- New toggle for hiding Prometheus warnings --- */}
        <Field
          label={t('grafana-prometheus.configuration.config-editor.hide-warnings', 'Hide Prometheus warnings')}
          description={t(
            'grafana-prometheus.configuration.config-editor.hide-warnings-description',
            'When enabled, warnings returned by Prometheus will be hidden in Grafana panels.'
          )}
        >
          <Switch
            value={options.jsonData.hideWarnings ?? false}
            onChange={onHideWarningsChange}
          />
        </Field>
      </ConfigSection>
    </>
  );
};
