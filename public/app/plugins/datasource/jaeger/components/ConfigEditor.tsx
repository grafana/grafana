import { css } from '@emotion/css';
import React from 'react';

import { DataSourcePluginOptionsEditorProps, GrafanaTheme2 } from '@grafana/data';
import { ConfigSection, DataSourceDescription } from '@grafana/experimental';
import { config } from '@grafana/runtime';
import { DataSourceHttpSettings, useStyles2 } from '@grafana/ui';
import { Divider } from 'app/core/components/Divider';
import { NodeGraphSection } from 'app/core/components/NodeGraphSettings';
import { TraceToLogsSection } from 'app/core/components/TraceToLogs/TraceToLogsSettings';
import { TraceToMetricsSection } from 'app/core/components/TraceToMetrics/TraceToMetricsSettings';
import { SpanBarSection } from 'app/features/explore/TraceView/components/settings/SpanBarSettings';

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

      <Divider />

      <DataSourceHttpSettings
        defaultUrl="http://localhost:16686"
        dataSourceConfig={options}
        showAccessOptions={false}
        onChange={onOptionsChange}
        secureSocksDSProxyEnabled={config.secureSocksDSProxyEnabled}
      />

      <TraceToLogsSection options={options} onOptionsChange={onOptionsChange} />

      <Divider />

      {config.featureToggles.traceToMetrics ? (
        <>
          <TraceToMetricsSection options={options} onOptionsChange={onOptionsChange} />
          <Divider />
        </>
      ) : null}

      <ConfigSection
        title="Additional settings"
        description="Additional settings are optional settings that can be configured for more control over your data source."
        isCollapsible={true}
        isInitiallyOpen={false}
      >
        <NodeGraphSection options={options} onOptionsChange={onOptionsChange} />
        <Divider hideLine={true} />
        <SpanBarSection options={options} onOptionsChange={onOptionsChange} />
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
