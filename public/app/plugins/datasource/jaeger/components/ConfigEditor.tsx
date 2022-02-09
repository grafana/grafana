import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { DataSourceHttpSettings } from '@grafana/ui';
import { NodeGraphSettings } from 'app/core/components/NodeGraphSettings';
import { TraceToLogsSettings } from 'app/core/components/TraceToLogsSettings';
import React from 'react';

export type Props = DataSourcePluginOptionsEditorProps;

export const ConfigEditor: React.FC<Props> = ({ options, onOptionsChange }) => {
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
      <div className="gf-form-group">
        <NodeGraphSettings options={options} onOptionsChange={onOptionsChange} />
      </div>
    </>
  );
};
