import React from 'react';

import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { ConfigSection, ConfigSubSection } from '@grafana/experimental';
import { config } from '@grafana/runtime';
import { DataSourceHttpSettings } from '@grafana/ui';
import { ConfigDescriptionLink } from 'app/core/components/ConfigDescriptionLink';
import { Divider } from 'app/core/components/Divider';
import { NodeGraphSection } from 'app/core/components/NodeGraphSettings';
import { TraceToLogsSection } from 'app/core/components/TraceToLogs/TraceToLogsSettings';
import { TraceToMetricsSection } from 'app/core/components/TraceToMetrics/TraceToMetricsSettings';
import { SpanBarSection } from 'app/features/explore/TraceView/components/settings/SpanBarSettings';

import { LokiSearchSettings } from './LokiSearchSettings';
import { QuerySettings } from './QuerySettings';
import { SearchSettings } from './SearchSettings';
import { ServiceGraphSettings } from './ServiceGraphSettings';
import { TraceQLSearchSettings } from './TraceQLSearchSettings';

export type Props = DataSourcePluginOptionsEditorProps;

export const ConfigEditor = ({ options, onOptionsChange }: Props) => {
  return (
    <>
      <DataSourceHttpSettings
        defaultUrl="http://tempo"
        dataSourceConfig={options}
        showAccessOptions={false}
        onChange={onOptionsChange}
        secureSocksDSProxyEnabled={config.secureSocksDSProxyEnabled}
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
        <ConfigSubSection
          title="Service graph"
          description={
            <ConfigDescriptionLink
              description="Select a Prometheus data source that contains the service graph data."
              suffix="tempo/#service-graph"
            />
          }
        >
          <ServiceGraphSettings options={options} onOptionsChange={onOptionsChange} />
        </ConfigSubSection>

        <Divider hideLine={true} />

        <NodeGraphSection options={options} onOptionsChange={onOptionsChange} />
        <Divider hideLine={true} />

        <ConfigSubSection
          title="Tempo search"
          description={
            <ConfigDescriptionLink description="Modify how traces are searched." suffix="tempo/#tempo-search" />
          }
        >
          {config.featureToggles.traceqlSearch ? (
            <TraceQLSearchSettings options={options} onOptionsChange={onOptionsChange} />
          ) : (
            <SearchSettings options={options} onOptionsChange={onOptionsChange} />
          )}
        </ConfigSubSection>

        <Divider hideLine={true} />

        <ConfigSubSection
          title="Loki search"
          description={
            <ConfigDescriptionLink
              description="Select a Loki data source to search for traces. Derived fields must be configured in the Loki data source."
              suffix="tempo/#loki-search"
            />
          }
        >
          <LokiSearchSettings options={options} onOptionsChange={onOptionsChange} />
        </ConfigSubSection>

        <Divider hideLine={true} />

        <ConfigSubSection
          title="TraceID query"
          description={
            <ConfigDescriptionLink description="Modify how TraceID queries are run." suffix="tempo/#traceid-query" />
          }
        >
          <QuerySettings options={options} onOptionsChange={onOptionsChange} />
        </ConfigSubSection>

        <Divider hideLine={true} />

        <SpanBarSection options={options} onOptionsChange={onOptionsChange} />
      </ConfigSection>
    </>
  );
};
