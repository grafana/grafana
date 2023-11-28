import { css } from '@emotion/css';
import React from 'react';

import { DataSourcePluginOptionsEditorProps, GrafanaTheme2 } from '@grafana/data';
import {
  AdvancedHttpSettings,
  Auth,
  ConfigSection,
  ConfigSubSection,
  ConnectionSettings,
  convertLegacyAuthProps,
  DataSourceDescription,
} from '@grafana/experimental';
import { config } from '@grafana/runtime';
import { SecureSocksProxySettings, useStyles2 } from '@grafana/ui';
import { ConfigDescriptionLink } from 'app/core/components/ConfigDescriptionLink';
import { Divider } from 'app/core/components/Divider';
import { NodeGraphSection } from 'app/core/components/NodeGraphSettings';
import { TraceToLogsSection } from 'app/core/components/TraceToLogs/TraceToLogsSettings';
import { TraceToMetricsSection } from 'app/core/components/TraceToMetrics/TraceToMetricsSettings';
import { SpanBarSection } from 'app/features/explore/TraceView/components/settings/SpanBarSettings';

import { LokiSearchSettings } from './LokiSearchSettings';
import { QuerySettings } from './QuerySettings';
import { ServiceGraphSettings } from './ServiceGraphSettings';
import { TraceQLSearchSettings } from './TraceQLSearchSettings';

export type Props = DataSourcePluginOptionsEditorProps;

export const ConfigEditor = ({ options, onOptionsChange }: Props) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      <DataSourceDescription
        dataSourceName="Tempo"
        docsLink="https://grafana.com/docs/grafana/latest/datasources/tempo"
        hasRequiredFields={false}
      />

      <Divider />
      <ConnectionSettings config={options} onChange={onOptionsChange} urlPlaceholder="http://localhost:3200" />

      <Divider />
      <Auth
        {...convertLegacyAuthProps({
          config: options,
          onChange: onOptionsChange,
        })}
      />

      <Divider />
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
        <AdvancedHttpSettings config={options} onChange={onOptionsChange} />

        {config.secureSocksDSProxyEnabled && (
          <>
            <Divider hideLine />
            <SecureSocksProxySettings options={options} onOptionsChange={onOptionsChange} />
          </>
        )}

        <Divider hideLine />
        <ConfigSubSection
          title="Service graph"
          description={
            <ConfigDescriptionLink
              description="Select a Prometheus data source that contains the service graph data."
              suffix="tempo/#service-graph"
              feature="the service graph"
            />
          }
        >
          <ServiceGraphSettings options={options} onOptionsChange={onOptionsChange} />
        </ConfigSubSection>

        <Divider hideLine />
        <NodeGraphSection options={options} onOptionsChange={onOptionsChange} />

        <Divider hideLine />
        <ConfigSubSection
          title="Tempo search"
          description={
            <ConfigDescriptionLink
              description="Modify how traces are searched."
              suffix="tempo/#tempo-search"
              feature="Tempo search"
            />
          }
        >
          <TraceQLSearchSettings options={options} onOptionsChange={onOptionsChange} />
        </ConfigSubSection>

        <Divider hideLine />
        <ConfigSubSection
          title="Loki search"
          description={
            <ConfigDescriptionLink
              description="Select a Loki data source to search for traces. Derived fields must be configured in the Loki data source."
              suffix="tempo/#loki-search"
              feature="Loki search"
            />
          }
        >
          <LokiSearchSettings options={options} onOptionsChange={onOptionsChange} />
        </ConfigSubSection>

        <Divider hideLine />
        <ConfigSubSection
          title="TraceID query"
          description={
            <ConfigDescriptionLink
              description="Modify how TraceID queries are run."
              suffix="tempo/#traceid-query"
              feature="the TraceID query"
            />
          }
        >
          <QuerySettings options={options} onOptionsChange={onOptionsChange} />
        </ConfigSubSection>

        <Divider hideLine />
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
