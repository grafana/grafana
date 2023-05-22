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

export type Props = DataSourcePluginOptionsEditorProps;

export const ConfigEditor = ({ options, onOptionsChange }: Props) => {
  return (
    <>
      <DataSourceHttpSettings
        defaultUrl="http://localhost:16686"
        dataSourceConfig={options}
        showAccessOptions={false}
        onChange={onOptionsChange}
        secureSocksDSProxyEnabled={config.secureSocksDSProxyEnabled}
      />

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
