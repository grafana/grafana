import { css } from '@emotion/css';

import { DataSourcePluginOptionsEditorProps, GrafanaTheme2 } from '@grafana/data';
import { NodeGraphSection, SpanBarSection, TraceToLogsSection, TraceToMetricsSection } from '@grafana/o11y-ds-frontend';
import {
  AdvancedHttpSettings,
  Auth,
  ConfigSection,
  ConnectionSettings,
  DataSourceDescription,
  convertLegacyAuthProps,
} from '@grafana/plugin-ui';
import { config } from '@grafana/runtime';
import { useStyles2, Divider, Stack, SecureSocksProxySettings } from '@grafana/ui';

export type Props = DataSourcePluginOptionsEditorProps;

export const ConfigEditor = ({ options, onOptionsChange }: Props) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      <DataSourceDescription
        dataSourceName="Zipkin"
        docsLink="https://grafana.com/docs/grafana/latest/datasources/zipkin"
        hasRequiredFields={false}
      />

      <Divider spacing={4} />

      <ConnectionSettings config={options} onChange={onOptionsChange} urlPlaceholder="http://localhost:9411" />

      <Divider spacing={4} />
      <Auth
        {...convertLegacyAuthProps({
          config: options,
          onChange: onOptionsChange,
        })}
      />

      <Divider spacing={4} />
      <TraceToLogsSection options={options} onOptionsChange={onOptionsChange} />
      <Divider spacing={4} />

      <TraceToMetricsSection options={options} onOptionsChange={onOptionsChange} />
      <Divider spacing={4} />

      <ConfigSection
        title="Additional settings"
        description="Additional settings are optional settings that can be configured for more control over your data source."
        isCollapsible={true}
        isInitiallyOpen={false}
      >
        <Stack gap={5} direction="column">
          <AdvancedHttpSettings config={options} onChange={onOptionsChange} />

          {config.secureSocksDSProxyEnabled && (
            <SecureSocksProxySettings options={options} onOptionsChange={onOptionsChange} />
          )}

          <NodeGraphSection options={options} onOptionsChange={onOptionsChange} />
          <SpanBarSection options={options} onOptionsChange={onOptionsChange} />
        </Stack>
      </ConfigSection>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    marginBottom: theme.spacing(2),
    maxWidth: '900px',
  }),
});
