import React from 'react';

import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { ConfigSection, ConfigSubSection } from '@grafana/experimental';
import { config } from '@grafana/runtime';
import { DataSourceHttpSettings } from '@grafana/ui';
import { ConfigDescriptionLink } from 'app/core/components/ConfigDescriptionLink';
import { Divider } from 'app/core/components/Divider';
import {
  NodeGraphSettings,
  NODE_GRAPH_TITLE,
  NODE_GRAPH_DESCRIPTION,
  NODE_GRAPH_SUFFIX,
} from 'app/core/components/NodeGraphSettings';
import {
  TraceToLogsSettings,
  TRACE_TO_LOGS_TITLE,
  TRACE_TO_LOGS_DESCRIPTION,
  TRACE_TO_LOGS_SUFFIX,
} from 'app/core/components/TraceToLogs/TraceToLogsSettings';
import {
  TraceToMetricsSettings,
  TRACE_TO_METRICS_TITLE,
  TRACE_TO_METRICS_DESCRIPTION,
  TRACE_TO_METRICS_SUFFIX,
} from 'app/core/components/TraceToMetrics/TraceToMetricsSettings';
import { SpanBarSettings } from 'app/features/explore/TraceView/components';
import {
  SPAN_BAR_TITLE,
  SPAN_BAR_DESCRIPTION,
  SPAN_BAR_SUFFIX,
} from 'app/features/explore/TraceView/components/settings/SpanBarSettings';

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

      <ConfigSection
        title={TRACE_TO_LOGS_TITLE}
        description={
          <ConfigDescriptionLink
            description={TRACE_TO_LOGS_DESCRIPTION}
            suffix={`${options.type}/${TRACE_TO_LOGS_SUFFIX}`}
          />
        }
        isCollapsible={true}
        isInitiallyOpen={true}
      >
        <TraceToLogsSettings options={options} onOptionsChange={onOptionsChange} />
      </ConfigSection>

      <Divider />

      {config.featureToggles.traceToMetrics ? (
        <>
          <ConfigSection
            title={TRACE_TO_METRICS_TITLE}
            description={
              <ConfigDescriptionLink
                description={TRACE_TO_METRICS_DESCRIPTION}
                suffix={`${options.type}/${TRACE_TO_METRICS_SUFFIX}`}
              />
            }
            isCollapsible={true}
            isInitiallyOpen={true}
          >
            <TraceToMetricsSettings options={options} onOptionsChange={onOptionsChange} />
          </ConfigSection>

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

        <Divider />

        <ConfigSubSection
          title={NODE_GRAPH_TITLE}
          description={
            <ConfigDescriptionLink
              description={NODE_GRAPH_DESCRIPTION}
              suffix={`${options.type}/${NODE_GRAPH_SUFFIX}`}
            />
          }
        >
          <NodeGraphSettings options={options} onOptionsChange={onOptionsChange} />
        </ConfigSubSection>

        <Divider />

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

        <Divider />

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

        <Divider />

        <ConfigSubSection
          title="TraceID query"
          description={
            <ConfigDescriptionLink description="Modify how TraceID queries are run." suffix="tempo/#traceid-query" />
          }
        >
          <QuerySettings options={options} onOptionsChange={onOptionsChange} />
        </ConfigSubSection>

        <Divider />

        <ConfigSubSection
          title={SPAN_BAR_TITLE}
          description={
            <ConfigDescriptionLink description={SPAN_BAR_DESCRIPTION} suffix={`${options.type}/${SPAN_BAR_SUFFIX}`} />
          }
        >
          <SpanBarSettings options={options} onOptionsChange={onOptionsChange} />
        </ConfigSubSection>
      </ConfigSection>
    </>
  );
};
