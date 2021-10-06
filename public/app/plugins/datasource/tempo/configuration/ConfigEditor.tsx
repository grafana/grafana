import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { DataSourceHttpSettings } from '@grafana/ui';
import { TraceToLogsSettings } from 'app/core/components/TraceToLogsSettings';
import React from 'react';
import { ServiceMapSettings } from './ServiceMapSettings';
import { config } from '@grafana/runtime';
import { SearchSettings } from './SearchSettings';
import { NodeGraphSettings } from 'app/core/components/NodeGraphSettings';

export type Props = DataSourcePluginOptionsEditorProps;

export const ConfigEditor: React.FC<Props> = ({ options, onOptionsChange }) => {
  return (
    <>
      <DataSourceHttpSettings
        defaultUrl="http://tempo"
        dataSourceConfig={options}
        showAccessOptions={false}
        onChange={onOptionsChange}
      />

      <div className="gf-form-group">
        <TraceToLogsSettings options={options} onOptionsChange={onOptionsChange} />
      </div>
      {config.featureToggles.tempoServiceGraph && (
        <div className="gf-form-group">
          <ServiceMapSettings options={options} onOptionsChange={onOptionsChange} />
        </div>
      )}
      {config.featureToggles.tempoSearch && (
        <div className="gf-form-group">
          <SearchSettings options={options} onOptionsChange={onOptionsChange} />
        </div>
      )}
      <div className="gf-form-group">
        <NodeGraphSettings options={options} onOptionsChange={onOptionsChange} />
      </div>
    </>
  );
};
