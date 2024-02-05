import { css } from '@emotion/css';
import React from 'react';

import { DataSourcePluginOptionsEditorProps, GrafanaTheme2 } from '@grafana/data';
import { ConfigSection, DataSourceDescription } from '@grafana/experimental';
import { NodeGraphSection, SpanBarSection, TraceToLogsSection, TraceToMetricsSection } from '@grafana/o11y-ds-frontend';
import { config } from '@grafana/runtime';
import { DataSourceHttpSettings, useStyles2, Divider, Stack } from '@grafana/ui';

import { TraceIdTimeParams } from './TraceIdTimeParams';

export type Props = DataSourcePluginOptionsEditorProps;

export const ConfigEditor = ({ options, onOptionsChange }: Props) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      <DataSourceDescription
        dataSourceName="Jaeger"
        docsLink="https://grafana.com/docs/grafana/latest/datasources/jaeger"
        hasRequiredFields={false}
      />

      <Divider spacing={4} />

      <DataSourceHttpSettings
        defaultUrl="http://localhost:16686"
        dataSourceConfig={options}
        showAccessOptions={false}
        onChange={onOptionsChange}
        secureSocksDSProxyEnabled={config.secureSocksDSProxyEnabled}
      />

      <TraceToLogsSection options={options} onOptionsChange={onOptionsChange} />

      <Divider spacing={4} />

      {config.featureToggles.traceToMetrics ? (
        <>
          <TraceToMetricsSection options={options} onOptionsChange={onOptionsChange} />
          <Divider spacing={4} />
        </>
      ) : null}

      <ConfigSection
        title="Additional settings"
        description="Additional settings are optional settings that can be configured for more control over your data source."
        isCollapsible={true}
        isInitiallyOpen={false}
      >
        <Stack gap={5} direction="column">
          <NodeGraphSection options={options} onOptionsChange={onOptionsChange} />
          <SpanBarSection options={options} onOptionsChange={onOptionsChange} />
          <TraceIdTimeParams options={options} onOptionsChange={onOptionsChange} />
        </Stack>
      </ConfigSection>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    label: container;
    margin-bottom: ${theme.spacing(2)};
    max-width: 900px;
  `,
});
