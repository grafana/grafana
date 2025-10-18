// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/configuration/ConfigEditor.tsx

import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { ConfigSection, DataSourceDescription, AdvancedHttpSettings } from '@grafana/plugin-ui';
import { config } from '@grafana/runtime';
import { Alert, useTheme2 } from '@grafana/ui';

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
      </ConfigSection>
    </>
  );
};
