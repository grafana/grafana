import React from 'react';

import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { config } from '@grafana/runtime';
import { DataSourceHttpSettings } from '@grafana/ui';
import { SpanBarSettings } from '@jaegertracing/jaeger-ui-components';
import { NodeGraphSettings } from 'app/core/components/NodeGraphSettings';
import { TraceToLogsSettings } from 'app/core/components/TraceToLogs/TraceToLogsSettings';
import { TraceToMetricsSettings } from 'app/core/components/TraceToMetrics/TraceToMetricsSettings';

export type Props = DataSourcePluginOptionsEditorProps;

export const ConfigEditor = ({ options, onOptionsChange }: Props) => {
  return (
    <>
      <DataSourceHttpSettings
        defaultUrl="http://localhost:16686"
        dataSourceConfig={options}
        showAccessOptions={false}
        onChange={onOptionsChange}
      />

      <div className="gf-form-group">
        <TraceToLogsSettings options={options} onOptionsChange={onOptionsChange} />
      </div>

      {config.featureToggles.traceToMetrics ? (
        <div className="gf-form-group">
          <TraceToMetricsSettings options={options} onOptionsChange={onOptionsChange} />
        </div>
      ) : null}

      <div className="gf-form-group">
        <NodeGraphSettings options={options} onOptionsChange={onOptionsChange} />
      </div>

      <div className="gf-form-group">
        <SpanBarSettings options={options} onOptionsChange={onOptionsChange} />
      </div>
    </>
  );
};
