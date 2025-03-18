import { css } from '@emotion/css';

import { DataSourcePluginOptionsEditorProps, GrafanaTheme2 } from '@grafana/data';
import {
  AdvancedHttpSettings,
  Auth,
  ConfigSection,
  ConfigDescriptionLink,
  ConfigSubSection,
  ConnectionSettings,
  convertLegacyAuthProps,
  DataSourceDescription,
} from '@grafana/experimental';
import {
  NodeGraphSection,
  SpanBarSection,
  TraceToLogsSection,
  TraceToMetricsSection,
  TraceToProfilesSection,
} from '@grafana/o11y-ds-frontend';
import { config } from '@grafana/runtime';
import { SecureSocksProxySettings, useStyles2, Divider, Stack } from '@grafana/ui';

import { QuerySettings } from './QuerySettings';
import { ServiceGraphSettings } from './ServiceGraphSettings';
import { StreamingSection } from './StreamingSection';
import { TraceQLSearchSettings } from './TraceQLSearchSettings';

export type ConfigEditorProps = DataSourcePluginOptionsEditorProps;

const ConfigEditor = ({ options, onOptionsChange }: ConfigEditorProps) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      <DataSourceDescription
        dataSourceName="Tempo"
        docsLink="https://grafana.com/docs/grafana/latest/datasources/tempo"
        hasRequiredFields={false}
      />

      <Divider spacing={4} />
      <ConnectionSettings config={options} onChange={onOptionsChange} urlPlaceholder="http://localhost:3200" />

      <Divider spacing={4} />
      <Auth
        {...convertLegacyAuthProps({
          config: options,
          onChange: onOptionsChange,
        })}
      />
      <Divider spacing={4} />

      <StreamingSection options={options} onOptionsChange={onOptionsChange} />
      <Divider spacing={4} />

      <TraceToLogsSection options={options} onOptionsChange={onOptionsChange} />
      <Divider spacing={4} />

      <TraceToMetricsSection options={options} onOptionsChange={onOptionsChange} />
      <Divider spacing={4} />

      <TraceToProfilesSection options={options} onOptionsChange={onOptionsChange} />
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

          <ConfigSubSection
            title="Service graph"
            description={
              <ConfigDescriptionLink
                description="Select a Prometheus data source that contains the service graph data."
                suffix="tempo/configure-tempo-data-source/#service-graph"
                feature="the service graph"
              />
            }
          >
            <ServiceGraphSettings options={options} onOptionsChange={onOptionsChange} />
          </ConfigSubSection>

          <NodeGraphSection options={options} onOptionsChange={onOptionsChange} />

          <ConfigSubSection
            title="Tempo search"
            description={
              <ConfigDescriptionLink
                description="Modify how traces are searched."
                suffix="tempo/configure-tempo-data-source/#tempo-search"
                feature="Tempo search"
              />
            }
          >
            <TraceQLSearchSettings options={options} onOptionsChange={onOptionsChange} />
          </ConfigSubSection>

          <ConfigSubSection
            title="TraceID query"
            description={
              <ConfigDescriptionLink
                description="Modify how TraceID queries are run."
                suffix="tempo/configure-tempo-data-source/#traceid-query"
                feature="the TraceID query"
              />
            }
          >
            <QuerySettings options={options} onOptionsChange={onOptionsChange} />
          </ConfigSubSection>

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

export default ConfigEditor;
